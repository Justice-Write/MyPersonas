import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  cleanImageTextDraft,
  ImageDraftActionError,
  exactImageReferenceCrop,
  imageDraftBindingHash,
  imageTextDraftResponse,
  revalidateImageTextSource,
  resolveImageTextSource,
  runImageTextDraft,
} from "../supabase/functions/_shared/image-caption-drafting.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [html, ownerApp, composer, proxy, browserContractSource, pagesWorkflow] = await Promise.all([
  readFile(path.join(root, "MyPersonas.Online_v0/index.html"), "utf8"),
  readFile(path.join(root, "MyPersonas.Online_v0/owner-app.js"), "utf8"),
  readFile(path.join(root, "supabase/functions/compose-post/index.ts"), "utf8"),
  readFile(path.join(root, "supabase/functions/ai-proxy/index.ts"), "utf8"),
  readFile(path.join(root, "MyPersonas.Online_v0/image-caption-drafting.js"), "utf8"),
  readFile(path.join(root, ".github/workflows/pages.yml"), "utf8"),
]);

const browserContext = { crypto: webcrypto, TextEncoder, URL };
browserContext.window = browserContext;
browserContext.globalThis = browserContext;
vm.runInNewContext(browserContractSource, browserContext, {
  filename: "image-caption-drafting.js",
});
const browserContract = browserContext.MyPersonasImageCaptionDrafting;

const OWNER = "11111111-1111-4111-8111-111111111111";
const PERSONA = "22222222-2222-4222-8222-222222222222";
const BACKEND = "33333333-3333-4333-8333-333333333333";
const ASSET_A = "44444444-4444-4444-8444-444444444444";
const ASSET_B = "55555555-5555-4555-8555-555555555555";
const DRAFT = "66666666-6666-4666-8666-666666666666";
const VARIANT = "77777777-7777-4777-8777-777777777777";
const PACKAGE = "88888888-8888-4888-8888-888888888888";
const REVISION = "2026-10-09T12:00:00.000Z";
const OBJECT_A = `https://example.supabase.co/storage/v1/object/public/persona-media/${OWNER}/published/provenance/none/${PERSONA}/a.jpg`;
const OBJECT_B = `https://example.supabase.co/storage/v1/object/public/persona-media/${OWNER}/published/provenance/none/${PERSONA}/b.jpg`;
const FB_RENDER_A = OBJECT_A.replace("/object/public/", "/render/image/public/") + "?width=1200&height=628&resize=cover&quality=82";

function baseTables() {
  return {
    personas: [{ id: PERSONA, owner: OWNER, ai_backend: BACKEND }],
    persona_media_assets: [
      { id: ASSET_A, owner: OWNER, persona_id: PERSONA, public_url: OBJECT_A, ai_use: "none", status: "active", media_type: "image", declaration_source: "owner" },
      { id: ASSET_B, owner: OWNER, persona_id: PERSONA, public_url: OBJECT_B, ai_use: "none", status: "active", media_type: "image", declaration_source: "owner" },
    ],
    drafts: [{
      id: DRAFT, owner: OWNER, persona_id: PERSONA, platform: "facebook",
      title: "Saved title", body: "Saved body", tags: "saved", media_url: OBJECT_A,
      media_asset_id: ASSET_A, publish_state: "not_queued", provider_post_id: "", updated_at: REVISION,
    }],
    post_drafts: [],
    persona_content_variants: [],
    persona_content_packages: [],
  };
}

function fakeAdmin(initial, { afterRead } = {}) {
  const tables = structuredClone(initial);
  const reads = [];
  let writes = 0;
  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select() { return this; }
    eq(key, value) { this.filters.push(["eq", key, value]); return this; }
    neq(key, value) { this.filters.push(["neq", key, value]); return this; }
    async maybeSingle() {
      const rows = (tables[this.table] || []).filter((row) => this.filters.every(([op, key, value]) => op === "eq" ? row[key] === value : row[key] !== value));
      const result = rows.length > 1 ? { data: null, error: new Error("multiple rows") } : { data: rows[0] || null, error: null };
      reads.push({ table: this.table, filters: structuredClone(this.filters), result: structuredClone(result.data) });
      if (afterRead) await afterRead({ table: this.table, tables, reads, result });
      return result;
    }
    insert() { writes += 1; throw new Error("unexpected insert"); }
    update() { writes += 1; throw new Error("unexpected update"); }
    upsert() { writes += 1; throw new Error("unexpected upsert"); }
    delete() { writes += 1; throw new Error("unexpected delete"); }
  }
  return {
    from(table) { return new Query(table); },
    tables,
    reads,
    get writes() { return writes; },
  };
}

async function boundBody({ sourceType = "owner_draft", sourceId = DRAFT, field = "body", revision = REVISION, assetId = ASSET_A, mediaUrl = OBJECT_A } = {}) {
  return {
    sourceType,
    sourceId,
    field,
    expectedRevision: revision,
    expectedImageAssetId: assetId,
    expectedBindingHash: await imageDraftBindingHash({ sourceType, sourceId, field, revision, assetId, mediaUrl }),
  };
}

test("browser preconditions expose only ids, revision, and a one-way binding hash", async () => {
  const request = await browserContract.requestPrecondition({
    sourceType: "owner_draft", sourceId: DRAFT, field: "body", revision: REVISION, assetId: ASSET_A, mediaUrl: OBJECT_A,
  });
  assert.deepEqual(Object.keys(request).sort(), ["expectedBindingHash", "expectedImageAssetId", "expectedRevision"]);
  assert.equal(request.expectedImageAssetId, ASSET_A);
  assert.match(request.expectedBindingHash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(request).includes(OBJECT_A), false);
  assert.equal(request.expectedBindingHash, await imageDraftBindingHash({ sourceType: "owner_draft", sourceId: DRAFT, field: "body", revision: REVISION, assetId: ASSET_A, mediaUrl: OBJECT_A }));
});

test("browser response verification rejects stale revision, asset, and binding results", async () => {
  const precondition = await browserContract.requestPrecondition({ sourceType: "owner_draft", sourceId: DRAFT, field: "body", revision: REVISION, assetId: ASSET_A, mediaUrl: OBJECT_A });
  const request = { sourceType: "owner_draft", sourceId: DRAFT, field: "body", precondition };
  const good = { sourceType: request.sourceType, sourceId: request.sourceId, field: request.field, sourceRevision: precondition.expectedRevision, bindingHash: precondition.expectedBindingHash, imageAssetId: precondition.expectedImageAssetId, saved: false, approved: false, text: "draft" };
  assert.equal(browserContract.verifyResponse(good, request), true);
  assert.equal(browserContract.verifyResponse({ ...good, bindingHash: "0".repeat(64) }, request), false);
  assert.equal(browserContract.verifyResponse({ ...good, imageAssetId: ASSET_B }, request), false);
  assert.equal(browserContract.verifyResponse({ ...good, sourceRevision: "later" }, request), false);
});

test("dirty modal controller disables saved-byte actions until reload", () => {
  const controls = [{ disabled: false, title: "", setAttribute(name, value) { this[name] = value; } }, { disabled: false, title: "", setAttribute(name, value) { this[name] = value; } }];
  const notice = { hidden: true };
  const modal = { dataset: {}, querySelectorAll() { return controls; }, querySelector() { return notice; } };
  assert.equal(browserContract.setModalDirty(modal, true), true);
  assert.equal(modal.dataset.imageDraftDirty, "true");
  assert.equal(notice.hidden, false);
  assert.ok(controls.every((item) => item.disabled && item["aria-disabled"] === "true"));
  browserContract.setModalDirty(modal, false);
  assert.ok(controls.every((item) => !item.disabled && item["aria-disabled"] === "false"));
});

test("first visible image predicate skips empty image placeholders identically", () => {
  const plan = [{ type: "image", source_url: "" }, { type: "video", source_url: "https://example.com/a.mp4" }, { type: "image", source_url: OBJECT_A }];
  assert.equal(browserContract.firstVisibleImage(plan).source_url, OBJECT_A);
});

test("exact rendition validator accepts direct assets and only the known bounded platform crop", () => {
  assert.deepEqual(exactImageReferenceCrop(OBJECT_A, OBJECT_A, "generated", "facebook"), { ok: true, crop: "" });
  assert.deepEqual(exactImageReferenceCrop(FB_RENDER_A, OBJECT_A, "none", "facebook"), { ok: true, crop: "facebook" });
  assert.equal(exactImageReferenceCrop(FB_RENDER_A.replace("width=1200", "width=1199"), OBJECT_A, "none", "facebook").ok, false);
  assert.equal(exactImageReferenceCrop(FB_RENDER_A, OBJECT_A, "generated", "facebook").ok, false);
});

test("owner draft happy path executes one provider mock and performs no database write", async () => {
  const admin = fakeAdmin(baseTables());
  const before = JSON.stringify(admin.tables);
  let providerCalls = 0;
  const result = await runImageTextDraft({
    admin, owner: OWNER, body: await boundBody(),
    generate: async (source, backendId) => { providerCalls += 1; assert.equal(source.imageCrop, ""); assert.equal(backendId, BACKEND); return "Generated body"; },
  });
  assert.equal(result.text, "Generated body");
  assert.equal(result.source.imageAssetId, ASSET_A);
  assert.equal(providerCalls, 1);
  assert.equal(admin.writes, 0);
  assert.equal(JSON.stringify(admin.tables), before);
});

test("a concurrent Queue image replacement fails before the provider mock", async () => {
  const admin = fakeAdmin(baseTables(), {
    afterRead({ table, tables }) {
      if (table === "personas") {
        tables.drafts[0].media_asset_id = ASSET_B;
        tables.drafts[0].media_url = OBJECT_B;
        tables.drafts[0].updated_at = "2026-10-09T12:01:00.000Z";
      }
    },
  });
  let providerCalls = 0;
  await assert.rejects(
    async () => runImageTextDraft({ admin, owner: OWNER, body: await boundBody(), generate: async () => { providerCalls += 1; return "never"; } }),
    (error) => error instanceof ImageDraftActionError && error.status === 409,
  );
  assert.equal(providerCalls, 0);
  assert.equal(admin.writes, 0);
});

test("the proxy source gate rejects a mutation after compose resolution and before provider disclosure", async () => {
  const admin = fakeAdmin(baseTables());
  const body = await boundBody();
  const composed = await resolveImageTextSource(admin, OWNER, body);
  assert.ok(composed.source);

  admin.tables.drafts[0].media_asset_id = ASSET_B;
  admin.tables.drafts[0].media_url = OBJECT_B;
  admin.tables.drafts[0].updated_at = "2026-10-09T12:02:00.000Z";

  let providerCalls = 0;
  await assert.rejects(
    async () => {
      await revalidateImageTextSource(admin, OWNER, body, composed.source);
      providerCalls += 1;
    },
    (error) => error instanceof ImageDraftActionError && error.status === 409,
  );
  assert.equal(providerCalls, 0);
});

test("legacy platform draft analyzes the exact shown transform and direct fallback without a guessed recrop", async () => {
  const tables = baseTables();
  tables.post_drafts.push({
    id: DRAFT, owner: OWNER, persona_id: PERSONA, status: "draft", brief: "brief",
    source_image_url: OBJECT_A, fb_image_url: FB_RENDER_A, ig_image_url: "", x_image_url: "",
    source_media_asset_id: ASSET_A, fb_media_asset_id: ASSET_A, ig_media_asset_id: ASSET_A, x_media_asset_id: ASSET_A,
    fb_post_id: "", ig_media_id: "", x_tweet_id: "", updated_at: REVISION,
  });
  const admin = fakeAdmin(tables);
  const facebook = await resolveImageTextSource(admin, OWNER, await boundBody({ sourceType: "post_draft", field: "fb_caption", mediaUrl: FB_RENDER_A }));
  assert.equal(facebook.source?.imageCrop, "facebook");
  const instagram = await resolveImageTextSource(admin, OWNER, await boundBody({ sourceType: "post_draft", field: "ig_caption", mediaUrl: OBJECT_A }));
  assert.equal(instagram.source?.imageCrop, "");
});

test("four-channel resolver skips an empty placeholder and binds the later displayed image", async () => {
  const tables = baseTables();
  tables.persona_content_packages.push({ id: PACKAGE, owner: OWNER, persona_id: PERSONA, status: "owner_review", title: "Kit", owner_guidance: "guide" });
  tables.persona_content_variants.push({
    id: VARIANT, owner: OWNER, persona_id: PERSONA, package_id: PACKAGE, channel: "facebook",
    title: "", body: "saved", description: "", media_plan: [{ type: "image", source_url: "" }, { type: "image", source_url: OBJECT_A }],
    status: "ready", provider_id: "", provider_url: "", updated_at: REVISION,
  });
  const admin = fakeAdmin(tables);
  const result = await resolveImageTextSource(admin, OWNER, await boundBody({ sourceType: "content_variant", sourceId: VARIANT, field: "body" }));
  assert.equal(result.source?.imageAssetId, ASSET_A);
});

test("posted or provider-bound four-channel variants fail without a provider call", async () => {
  const tables = baseTables();
  tables.persona_content_packages.push({ id: PACKAGE, owner: OWNER, persona_id: PERSONA, status: "approved", title: "Kit", owner_guidance: "" });
  tables.persona_content_variants.push({
    id: VARIANT, owner: OWNER, persona_id: PERSONA, package_id: PACKAGE, channel: "facebook",
    title: "", body: "saved", description: "", media_plan: [{ type: "image", source_url: OBJECT_A }],
    status: "manually_posted", provider_id: "receipt", provider_url: "", updated_at: REVISION,
  });
  const admin = fakeAdmin(tables);
  let providerCalls = 0;
  await assert.rejects(
    async () => runImageTextDraft({ admin, owner: OWNER, body: await boundBody({ sourceType: "content_variant", sourceId: VARIANT, field: "body" }), generate: async () => { providerCalls += 1; return "never"; } }),
    (error) => error instanceof ImageDraftActionError && error.status === 409,
  );
  assert.equal(providerCalls, 0);
});

test("X copy is behaviorally capped and generated responses remain unsaved suggestions", () => {
  const source = {
    sourceType: "content_variant",
    sourceId: VARIANT,
    sourceRevision: REVISION,
    bindingHash: "a".repeat(64),
    personaId: PERSONA,
    imageAssetId: ASSET_A,
    imageCrop: "",
    platform: "x",
    field: "body",
    context: "",
  };
  const cleaned = cleanImageTextDraft(`\"${"x".repeat(400)}\"`, "body", "x");
  assert.equal(cleaned.length, 280);
  assert.equal(cleanImageTextDraft("y".repeat(400), "body", "twitter").length, 280);
  const response = imageTextDraftResponse(source, cleaned);
  assert.equal(response.text.length, 280);
  assert.equal(response.saved, false);
  assert.equal(response.approved, false);
  assert.equal(response.imageAssetId, ASSET_A);
});

test("legacy twitter Queue rows normalize to the X prompt and output contract", async () => {
  const tables = baseTables();
  tables.drafts[0].platform = "twitter";
  const resolved = await resolveImageTextSource(
    fakeAdmin(tables),
    OWNER,
    await boundBody(),
  );
  assert.equal(resolved.source?.platform, "x");
  assert.equal(
    cleanImageTextDraft("z".repeat(400), "body", resolved.source?.platform || "").length,
    280,
  );
});

test("UI and service wire every field to immutable preconditions and unsaved-only results", () => {
  for (const field of ["title", "body", "description", "alt_text"]) assert.match(ownerApp, new RegExp(`ownerAppVariantFieldLabel\\(variant, "${field}"`));
  assert.match(ownerApp, /ownerAppSetPackageDirty\(true\)/);
  assert.match(ownerApp, /data-requires-saved-kit/);
  assert.match(ownerApp, /ownerAppRequireSavedPackage\(\)/);
  assert.match(composer, /\["x", "twitter"\]\.includes\(platform\)[\s\S]*?Write one X post of at most/);
  assert.match(composer, /expectedImageAssetId/);
  assert.match(composer, /expectedBindingHash/);
  assert.match(composer, /sourceBinding:[\s\S]*sourceType: source\.sourceType/);
  assert.match(composer, /imageTextDraftResponse\(source, result\.text\)/);
  assert.match(html, /MyPersonasImageCaptionDrafting\.verifyResponse/);
});

test("secure proxy revalidates the source binding and exact active asset after derivative creation and before fetch", () => {
  assert.match(proxy, /async function registeredImageStillActive/);
  assert.match(proxy, /image_asset_inactive_before_provider/);
  assert.match(proxy, /image_source_changed_before_provider/);
  assert.match(proxy, /provider_fetch_issued: false/);
  const sourceFinalCheck = proxy.lastIndexOf("await revalidateImageTextSource(");
  const finalCheck = proxy.indexOf("const liveImage = await registeredImageStillActive");
  const providerFetch = proxy.indexOf("const providerResponse = await fetch(endpoint.url");
  assert.ok(finalCheck > proxy.indexOf("loadRegisteredImage("));
  assert.ok(sourceFinalCheck > finalCheck);
  assert.ok(sourceFinalCheck < providerFetch);
  assert.ok(finalCheck < providerFetch);
  assert.match(proxy, /\.eq\("storage_path", asset\.storage_path\)/);
  assert.match(proxy, /\.eq\("content_sha256", asset\.content_sha256\)/);
});

test("Pages packages the image-drafting runtime loaded by the release HTML", () => {
  assert.match(html, /<script src="\.\/image-caption-drafting\.js\?v=/);
  const artifactStep = pagesWorkflow.slice(
    pagesWorkflow.indexOf("- name: Prepare public site artifact"),
    pagesWorkflow.indexOf("- uses: actions/upload-pages-artifact@"),
  );
  const include = artifactStep.indexOf("--include '/image-caption-drafting.js'");
  const excludeAll = artifactStep.lastIndexOf("--exclude '*'");
  assert.ok(include >= 0 && include < excludeAll);
});

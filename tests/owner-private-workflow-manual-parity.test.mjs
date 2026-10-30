import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

// Source/document parity and synthetic pure-helper checks only. These tests do
// not call Supabase, execute SQL, open a browser, or establish live acceptance.
const root = path.resolve(import.meta.dirname, "..");
const appRoot = path.join(root, "MyPersonas.Online_v0");
const read = (relative) => readFile(path.join(appRoot, relative), "utf8");
const [guide, contract, source, previewSql, creationSql] = await Promise.all([
  read("OWNER-PRIVATE-DRAFT-GUIDE.md"),
  read("OWNER-MOBILE-COMMAND-CENTER.md"),
  read("owner-app.js"),
  read("sql-updates/073-content-package-preview-gate.sql"),
  read("sql-updates/077-mobile-private-draft-workflow.sql"),
]);
const prose = guide.replace(/\*\*/g, "").replace(/\s+/g, " ");
const ui = source.replace(/&amp;/g, "&").replace(/\s+/g, " ");
const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function appFunction(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${escaped(name)}\\(`, "m"));
  assert.notEqual(start, -1, `${name} exists in owner-app.js`);
  const tail = source.slice(start);
  const next = tail.slice(1).search(/^(?:async )?function \w+\(/m);
  return next === -1 ? tail : tail.slice(0, next + 1);
}

function sqlFunction(sql, name) {
  const body = sql.match(new RegExp(
    `create or replace function public\\.${escaped(name)}\\([\\s\\S]*?^\\$\\$;`, "mi",
  ))?.[0];
  assert.ok(body, `${name} exists in SQL source`);
  return body;
}

await import(pathToFileURL(path.join(appRoot, "mobile-owner-workflow.js")).href);
const workflow = globalThis.MobileOwnerWorkflow;
const owner = "synthetic-owner";
const personaId = "synthetic-persona";
const personas = [{ id: personaId, owner, name: "Synthetic persona" }];
const channels = ["x", "instagram", "facebook", "website"];
const accounts = channels.map((channel) => ({
  id: `synthetic-ledger-${channel}`,
  owner,
  persona_id: personaId,
  provider: channel === "x" ? "twitter" : channel === "website" ? "wordpress" : channel,
  suspended: false,
}));
const variants = () => channels.map((channel) => ({
  channel, title: "", body: `Synthetic ${channel} copy`, description: "", alt_text: "", media_plan: [],
}));
const request = (overrides = {}) => workflow.createPrivateDraftRequest({
  ownerId: owner, personaId, personas, accounts, variants: variants(),
  title: "Synthetic private draft", guidance: "Synthetic context only", timezone: "UTC",
  publishingEnabled: false, online: true, ...overrides,
});

test("private-draft guide links resolve and distinguish source evidence from live acceptance", async () => {
  assert.match(guide, /^# Create and review a private four-channel kit/m);
  assert.match(prose, /not the separate legacy publishing queue/i);
  assert.match(prose, /matching deployed UI, signed-in backend and reviewed migrations/i);
  assert.match(prose, /not a live or device acceptance receipt/i);
  assert.match(prose, /not proof of applied migrations, real account bindings, privacy isolation, timeout recovery or physical-phone behavior/i);
  assert.match(contract, /\]\(OWNER-PRIVATE-DRAFT-GUIDE\.md\)/);
  const links = [...guide.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  assert.ok(links.includes("OWNER-MOBILE-COMMAND-CENTER.md"));
  for (const target of links) {
    assert.doesNotMatch(target, /^(?:https?:|[a-z]:|\/|\\)/i, "new walkthrough links stay portable and local");
    const [relative, anchor] = target.split("#");
    const resolved = path.resolve(appRoot, relative);
    assert.ok(resolved.startsWith(`${appRoot}${path.sep}`), "guide link stays inside the app documentation");
    assert.equal((await stat(resolved)).isFile(), true);
    if (anchor) {
      const targetText = await readFile(resolved, "utf8");
      const anchors = [...targetText.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1]
        .toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, "").trim().replace(/\s+/g, "-"));
      assert.ok(anchors.includes(anchor), `local heading ${target} exists`);
    }
  }
});

test("walkthrough labels and captured persona agree with the actual text-only composer", () => {
  for (const label of ["New private draft", "Write a four-channel kit", "Package title", "Owner guidance", "Save private draft for review"]) {
    assert.ok(prose.includes(label), `guide names ${label}`);
    assert.ok(ui.includes(label), `owner UI provides ${label}`);
  }
  const open = appFunction("ownerAppOpenPrivateDraft");
  const save = appFunction("ownerAppSavePrivateDraft");
  assert.match(open, /ownedPersona\(myPersonas, uid, personaId\)/);
  assert.match(open, /ownerAppChannelBindings\(persona\.id\)/);
  assert.match(open, /ownerAppBindingHtml\(bindings\)/);
  assert.match(open, /ownerAppSavePrivateDraft\('\$\{persona\.id\}'\)/);
  assert.doesNotMatch(open, /<select\b|type=["']file["']|requestedBindings|autosave/i);
  assert.doesNotMatch(save, /requestedBindings/);
  assert.match(prose, /does not contain an account-picker dropdown/i);
  assert.match(prose, /Save button retains the persona selected when the form opened/i);
  assert.match(prose, /does not autosave its text/i);
  assert.match(save, /await ownerAppLoad\(true\)/);
  assert.match(save, /go\(`schedule\/\$\{created\.data\}`\)/);
  for (const label of ["Needs review", "Content kits", "Review queue", "Review posts", "Open queue"]) {
    assert.ok(prose.includes(label));
    assert.ok(ui.includes(label));
  }
});

test("four exact eligible assignments are required without conflating ignored rows or optional helper selection", () => {
  const complete = request();
  assert.equal(complete.ok, true);
  assert.deepEqual(Object.keys(complete.payload.p_bindings), channels);
  assert.equal(complete.payload.p_bindings.x.ledger_id, "synthetic-ledger-x");
  assert.equal(complete.payload.p_bindings.website.provider, "wordpress");
  for (const accountChange of [
    accounts.filter((account) => account.provider !== "instagram"),
    accounts.map((account) => account.provider === "instagram" ? { ...account, suspended: true } : account),
    accounts.map((account) => account.provider === "instagram" ? { ...account, owner: "different-owner" } : account),
  ]) assert.equal(request({ accounts: accountChange }).ok, false);
  assert.equal(request({ accounts: [
    ...accounts,
    { ...accounts[1], id: "synthetic-suspended-instagram", suspended: true },
    { ...accounts[1], id: "synthetic-foreign-instagram", owner: "different-owner" },
    { ...accounts[1], id: "synthetic-other-persona-instagram", persona_id: "different-persona" },
  ] }).ok, true, "irrelevant or ineligible rows do not make the exact assigned row ambiguous");
  const multiple = [...accounts, { ...accounts[1], id: "synthetic-second-instagram" }];
  const ambiguous = request({ accounts: multiple });
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.bindings.find((binding) => binding.channel === "instagram").state, "ambiguous");
  // The pure helper supports explicit selection for other callers. This form
  // passes no requestedBindings, and SQL 077 independently requires count=1.
  assert.equal(workflow.bindingState(multiple, owner, personaId, "instagram", "synthetic-second-instagram").determinable, true);
  const bindingSql = sqlFunction(creationSql, "assert_owner_mobile_draft_bindings");
  assert.match(bindingSql, /ledger\.owner = p_owner/);
  assert.match(bindingSql, /ledger\.persona_id = p_persona_id/);
  assert.match(bindingSql, /not ledger\.suspended/);
  assert.match(bindingSql, /select count\(\*\)[\s\S]*?\) <> 1 then/);
  assert.match(prose, /exactly one eligible, non-suspended account assigned to this owner and persona for the matching provider/i);
  assert.match(prose, /Suspended or foreign rows cannot supply that binding and are ignored/i);
  assert.match(prose, /zero or multiple eligible assignments block saving/i);
  assert.match(prose, /Do not guess a target, remove legitimate accounts merely to bypass the check/i);
});

test("documented composer body limits are enforced at each synthetic helper boundary", () => {
  const expected = { x: 280, instagram: 5000, facebook: 10000, website: 30000 };
  assert.deepEqual(workflow.VARIANT_LIMITS, expected);
  for (const { key, label } of workflow.CHANNELS) {
    const limit = expected[key];
    assert.match(guide, new RegExp(`\\| ${label} \\| ${limit.toLocaleString("en-US")} \\|`));
    const atLimit = variants().map((variant) => variant.channel === key ? { ...variant, body: "a".repeat(limit) } : variant);
    assert.equal(request({ variants: atLimit }).ok, true, `${key} exact bound is accepted`);
    const overLimit = atLimit.map((variant) => variant.channel === key ? { ...variant, body: `${variant.body}a` } : variant);
    assert.equal(request({ variants: overLimit }).ok, false, `${key} overflow is rejected`);
  }
  const bounded = request({ title: "t".repeat(301), guidance: "g".repeat(6001) });
  assert.equal(bounded.payload.p_title.length, 300);
  assert.equal(bounded.payload.p_owner_guidance.length, 6000);
  assert.equal(request({ title: " ", guidance: "" }).payload.p_title, "Mobile private draft");
  assert.equal(request({ title: " ", guidance: "" }).payload.p_owner_guidance, "");
  assert.match(prose, /not verified current provider limits or the limits of every other editor/i);
  assert.match(prose, /Title is bounded to 300 characters and guidance to 6,000/i);
  assert.match(prose, /Leaving the title blank uses the default Mobile private draft/i);
  assert.match(appFunction("ownerAppOpenPrivateDraft"), /variantLimit\(channel\.key\)/);
});

test("initial private form has empty media plans while saved existing kits may retain media", () => {
  const result = request();
  assert.ok(result.payload.p_variants.every((variant) => variant.media_plan.length === 0));
  assert.equal(request({ variants: variants().slice(0, 3) }).ok, false);
  assert.equal(request({ variants: variants().map((variant) => variant.channel === "x"
    ? { ...variant, media_plan: [{ type: "image", source_url: "https://synthetic.invalid/image.png" }] } : variant) }).ok, false);
  assert.equal(request({ variants: variants().map((variant) => variant.channel === "x" ? { ...variant, body: " " } : variant) }).ok, false);
  assert.match(appFunction("ownerAppSavePrivateDraft"), /media_plan:\s*\[\]/);
  assert.match(appFunction("ownerAppSavePackage"), /media_plan: Array\.isArray\(variant\.media_plan\) \? variant\.media_plan : \[\]/);
  assert.match(prose, /initial form is text-only: it creates empty media plans/i);
  assert.match(prose, /Existing content kits may have media/i);
  assert.match(prose, /Owner guidance is stored context, not a request that automatically calls an AI/i);
});

test("saved-byte review guidance matches dirty guards and material-edit approval invalidation", () => {
  const save = appFunction("ownerAppSavePackage");
  assert.match(save, /sb\.rpc\("save_owner_content_package_draft"/);
  assert.match(save, /Kit saved; any prior approval was cleared/);
  assert.match(save, /ownerAppEditPackage\(id\)/);
  const dirtyGuard = appFunction("ownerAppRequireSavedPackage");
  assert.match(dirtyGuard, /if \(!ownerAppPackageModalDirty\(\)\) return true/);
  assert.match(dirtyGuard, /Save and reload this changed kit/);
  for (const handler of ["ownerAppPreviewPackageAction", "ownerAppCopyVariant", "ownerAppOpenChannel"]) {
    assert.match(appFunction(handler), /if \(!ownerAppRequireSavedPackage\(\)\) return/);
  }
  for (const name of ["invalidate_content_package_approval", "guard_content_package_material_edit"]) {
    const body = sqlFunction(previewSql, name);
    assert.match(body, /invalidated_at=now\(\)/);
    assert.match(body, /owner_review/);
    assert.match(body, /scheduled_for\s*(?:=|:=)[^;]*null/);
  }
  assert.match(prose, /Material edits clear prior approval and remove the kit from the manual schedule/i);
  assert.match(prose, /saved bytes, not whatever is still in an unsaved textbox/i);
  for (const label of ["Review & edit", "Save changes", "Save and reload"]) {
    assert.ok(prose.includes(label));
    assert.ok(ui.includes(label));
  }
});

test("future manual time and five-minute session-bound single-use receipt require separate acknowledgement then commit", () => {
  assert.match(appFunction("ownerAppPackageProposal"), /Date\.parse\(scheduledFor\) <= Date\.now\(\)/);
  assert.match(appFunction("ownerAppPackageProposal"), /Choose a future proposed manual-work time/);
  const preview = appFunction("ownerAppPreviewPackageAction");
  assert.match(preview, /sb\.rpc\("content_package_preview_snapshot"/);
  assert.match(preview, /p_scheduled_for: proposal\.scheduledFor/);
  assert.match(preview, /onConfirm: \(\) => ownerAppCommitPackagePreview\(id, snapshot\)/);
  const commit = appFunction("ownerAppCommitPackagePreview");
  assert.match(commit, /Date\.parse\(snapshot\?\.expires_at \|\| ""\) <= Date\.now\(\)/);
  const acknowledgeAt = commit.indexOf('await sb.rpc("acknowledge_content_package_preview", proof)');
  const commitAt = commit.indexOf('await sb.rpc("commit_content_package_preview", proof)');
  assert.ok(acknowledgeAt !== -1 && commitAt > acknowledgeAt, "same proof is acknowledged before commit");
  assert.match(commit.slice(acknowledgeAt, commitAt), /if \(acknowledgement\.error\)[\s\S]*return/);
  const snapshot = sqlFunction(previewSql, "content_package_preview_snapshot");
  assert.match(snapshot, /v_now \+ interval '5 minutes'/);
  assert.match(snapshot, /perform public\.require_aal2\(\)/);
  for (const name of ["acknowledge_content_package_preview", "commit_content_package_preview"]) {
    const body = sqlFunction(previewSql, name);
    assert.match(body, /require_aal2\(\)/);
    assert.match(body, /preview_session_id is distinct from/);
    assert.match(body, /expires_at\s*<=\s*v_now/);
    assert.match(body, /consumed_at is not null/);
  }
  assert.match(prose, /Pick a future time even if you only want to approve now/i);
  assert.match(prose, /Exact approval and manual scheduling also require an MFA-verified owner session \(AAL2\)/i);
  assert.match(prose, /never send codes or recovery secrets in chat/i);
  assert.match(prose, /receipt expires after five minutes and is session-bound and single-use/i);
  assert.match(prose, /Expired, changed or rejected evidence needs a fresh preview/i);
});

test("approval and subsequent manual schedule remain separate from provider sending", () => {
  const pack = { id: "synthetic-kit", owner, persona_id: personaId, status: "owner_review" };
  const approve = workflow.approvalDecision({ ownerId: owner, pack, action: "approve", online: true });
  assert.equal(approve.ok, true);
  assert.equal(approve.publishes, false);
  assert.equal(approve.rpc, "content_package_preview_snapshot");
  const bindings = workflow.channelBindings(accounts, owner, personaId);
  assert.equal(workflow.approvalDecision({ ownerId: owner, pack, action: "manual_schedule", bindings }).ok, false);
  const schedule = workflow.approvalDecision({ ownerId: owner, pack: { ...pack, status: "approved" }, action: "manual_schedule", bindings });
  assert.equal(schedule.ok, true);
  assert.equal(schedule.publishes, false);
  for (const action of ["publish", "provider_send"]) {
    assert.equal(workflow.approvalDecision({ ownerId: owner, pack, action }).ok, false);
  }
  assert.equal(workflow.PUBLISHING_ENABLED, false);
  assert.equal(request().payload.publishing_enabled, false);
  assert.match(creationSql, /check \(publishing_enabled = false\)/);
  const commit = sqlFunction(previewSql, "commit_content_package_preview");
  assert.match(commit, /if p_action='approve' then[\s\S]*?status='approved'[\s\S]*?scheduled_for=null/);
  assert.match(commit, /status='scheduled',scheduled_for=p_scheduled_for/);
  assert.doesNotMatch(commit, /http_post|net\.http|pg_net/);
  assert.match(prose, /Approval does not schedule or publish/i);
  assert.match(prose, /manual plan after approval/i);
  assert.match(prose, /Manual schedule, not a provider queue or a post/i);
  for (const label of ["Approve exact four-card preview", "Preview & place on schedule", "Approve previews & place on manual schedule"]) {
    assert.ok(prose.includes(label));
    assert.ok(ui.includes(label));
  }
});

test("reject is a confirmed destructive draft deletion rather than reversible hiding", () => {
  const reject = appFunction("ownerAppRejectPackage");
  const confirmAt = reject.indexOf('confirm("Delete this owner-review draft? Nothing is published. This cannot be undone.")');
  const deleteAt = reject.indexOf('sb.rpc("delete_owner_content_package_draft"');
  assert.ok(confirmAt !== -1 && deleteAt > confirmAt);
  assert.match(reject.slice(confirmAt, deleteAt), /return/);
  assert.match(prose, /Reject draft asks to delete the owner-review draft/i);
  assert.match(prose, /cannot be undone/i);
  assert.match(prose, /not a reversible hide button or a provider deletion/i);
  assert.match(prose, /Use Cancel or Close if you only want to leave a form/i);
});

test("uncertain writes require manual reconciliation and preferences are neither backup nor offline authoring", () => {
  const save = appFunction("ownerAppSavePrivateDraft");
  assert.equal([...save.matchAll(/sb\.rpc\("create_owner_mobile_private_draft"/g)].length, 1);
  assert.doesNotMatch(save, /idempot|retry|setInterval|setTimeout/i);
  const create = sqlFunction(creationSql, "create_owner_mobile_private_draft");
  assert.doesNotMatch(create.slice(0, create.indexOf("returns uuid")), /idempot|retry|request_id/i);
  assert.match(prose, /not proof that no write occurred/i);
  assert.match(prose, /no documented idempotency\/retry token/i);
  assert.match(prose, /Do not double-click Save or automatically repeat creation, acknowledgement or approval/i);
  assert.match(prose, /inspect the persisted kit, body and status before deciding/i);
  assert.match(prose, /stop and ask the site technician/i);
  const bundle = workflow.exportBundle({ ownerId: owner, selectedPersonaId: personaId, draftIds: ["synthetic-kit"], exportedAt: "2026-10-24T00:00:00Z" });
  assert.deepEqual(Object.keys(bundle).sort(), ["version", "exported_at", "owner_id", "selected_persona_id", "draft_ids", "publishing_enabled", "note"].sort());
  assert.match(bundle.note, /not a user-data backup of private draft bodies/i);
  assert.equal(workflow.importBundle(bundle, { ownerId: "different-owner", personas }).ok, false);
  assert.equal(request({ online: false }).ok, false);
  assert.equal(workflow.approvalDecision({ ownerId: owner, pack: { owner, status: "owner_review" }, action: "approve", online: false }).ok, false);
  assert.ok(workflow.OFFLINE_LIMITATIONS.some((line) => /never caches owner-app\.js, owner drafts, or Supabase responses/.test(line)));
  assert.match(prose, /not a draft backup, account transfer or offline authoring system/i);
  assert.match(prose, /offline shell and disconnected Android WebView cannot create or approve drafts/i);
  assert.match(prose, /presence in Git does not prove they were applied/i);
});

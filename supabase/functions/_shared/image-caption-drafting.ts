export const IMAGE_DRAFT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const IMAGE_DRAFT_FIELDS = new Set([
  "fb_caption",
  "ig_caption",
  "x_caption",
  "title",
  "body",
  "description",
  "alt_text",
  "brief",
  "tags",
]);

const STANDARD_CROPS = Object.freeze({
  facebook: Object.freeze({ width: 1200, height: 628, key: "facebook" }),
  instagram: Object.freeze({ width: 1080, height: 1080, key: "instagram" }),
  x: Object.freeze({ width: 1080, height: 1350, key: "x" }),
});

type CropKey = "facebook" | "instagram" | "x" | "";

type ImageAsset = {
  id: string;
  persona_id: string;
  public_url: string;
  ai_use: string;
};

export type ImageTextSource = {
  sourceType: string;
  sourceId: string;
  sourceRevision: string;
  bindingHash: string;
  personaId: string;
  imageAssetId: string;
  imageCrop: CropKey;
  platform: string;
  field: string;
  context: string;
};

export type ImageTextResolution = {
  source?: ImageTextSource;
  error?: string;
  status?: number;
};

export class ImageDraftActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ImageDraftActionError";
    this.status = status;
  }
}

export function imageTextDraftLimit(field: string, platform: string) {
  if (field === "x_caption") return 280;
  if (field === "fb_caption") return 5_000;
  if (field === "ig_caption") return 2_200;
  if (field === "title") return 300;
  if (field === "brief") return 4_000;
  if (field === "tags") return 2_000;
  if (field === "description" || field === "alt_text") return 2_000;
  if (field === "body" && ["x", "twitter"].includes(platform)) return 280;
  return platform === "website" ? 30_000 : 10_000;
}

export function cleanImageTextDraft(
  content: string,
  field: string,
  platform: string,
) {
  let value = content.trim();
  const fenced = value.match(/^```(?:text|markdown)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) value = fenced[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value.slice(0, imageTextDraftLimit(field, platform));
}

export function imageTextDraftResponse(source: ImageTextSource, text: string) {
  return {
    text,
    field: source.field,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceRevision: source.sourceRevision,
    bindingHash: source.bindingHash,
    imageAssetId: source.imageAssetId,
    saved: false,
    approved: false,
  };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function platformCrop(platform: string) {
  const normalized = platform === "twitter" ? "x" : platform;
  return STANDARD_CROPS[normalized as keyof typeof STANDARD_CROPS] || null;
}

function canonicalTransformObjectUrl(reference: string) {
  try {
    const url = new URL(reference);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      return "";
    }
    const marker = "/storage/v1/render/image/public/";
    if (!url.pathname.includes(marker)) return "";
    url.pathname = url.pathname.replace(
      marker,
      "/storage/v1/object/public/",
    );
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function exactImageReferenceCrop(
  reference: string,
  publicUrl: string,
  aiUse: string,
  platform: string,
): { ok: true; crop: CropKey } | { ok: false; error: string } {
  const shown = clean(reference);
  const registered = clean(publicUrl);
  if (!shown || !registered) {
    return { ok: false, error: "This draft has no exact registered image." };
  }
  if (shown === registered) return { ok: true, crop: "" };
  if (clean(aiUse) !== "none" || canonicalTransformObjectUrl(shown) !== registered) {
    return {
      ok: false,
      error:
        "The displayed image is not the exact registered rendition. Prepare that crop in the persona media library first.",
    };
  }

  const crop = platformCrop(platform);
  if (!crop) {
    return {
      ok: false,
      error:
        "This transformed image cannot be reproduced exactly for AI inspection. Register the displayed crop as its own media asset first.",
    };
  }
  try {
    const url = new URL(shown);
    const allowed = new Set(["width", "height", "resize", "quality", "format"]);
    const seen = new Set<string>();
    for (const [key, value] of url.searchParams.entries()) {
      if (!allowed.has(key) || seen.has(key)) {
        return { ok: false, error: "The displayed image transform is not supported." };
      }
      seen.add(key);
      if (key === "quality" && !/^(?:[2-9][0-9]|100)$/.test(value)) {
        return { ok: false, error: "The displayed image quality transform is invalid." };
      }
      if (key === "format" && !["origin", "webp"].includes(value)) {
        return { ok: false, error: "The displayed image format transform is invalid." };
      }
    }
    if (
      url.searchParams.get("width") !== String(crop.width) ||
      url.searchParams.get("height") !== String(crop.height) ||
      url.searchParams.get("resize") !== "cover"
    ) {
      return {
        ok: false,
        error:
          "The displayed crop does not match the platform rendition. Register the displayed crop as its own media asset first.",
      };
    }
  } catch {
    return { ok: false, error: "The displayed image reference is invalid." };
  }
  return { ok: true, crop: crop.key as CropKey };
}

export async function imageDraftBindingHash(input: {
  sourceType: string;
  sourceId: string;
  field: string;
  revision: string;
  assetId: string;
  mediaUrl: string;
}) {
  const bytes = new TextEncoder().encode(JSON.stringify([
    clean(input.sourceType),
    clean(input.sourceId),
    clean(input.field),
    clean(input.revision),
    clean(input.assetId),
    clean(input.mediaUrl),
  ]));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function ownedAssetById(
  admin: any,
  owner: string,
  personaId: string,
  assetId: string,
) {
  if (!IMAGE_DRAFT_UUID.test(assetId)) {
    return { asset: null, error: "This draft has no registered image." };
  }
  const result = await admin.from("persona_media_assets")
    .select("id,persona_id,public_url,ai_use")
    .eq("id", assetId)
    .eq("owner", owner)
    .eq("persona_id", personaId)
    .eq("media_type", "image")
    .eq("status", "active")
    .neq("declaration_source", "legacy")
    .maybeSingle();
  if (result.error) {
    return { asset: null, error: "The persona media library could not be verified." };
  }
  return {
    asset: result.data as ImageAsset | null,
    error: result.data
      ? ""
      : "Import or prepare this image in the persona media library before asking a model to inspect it.",
  };
}

async function ownedAssetByOwnerId(admin: any, owner: string, assetId: string) {
  if (!IMAGE_DRAFT_UUID.test(assetId)) {
    return { asset: null, error: "This draft has no registered image." };
  }
  const result = await admin.from("persona_media_assets")
    .select("id,persona_id,public_url,ai_use")
    .eq("id", assetId)
    .eq("owner", owner)
    .eq("media_type", "image")
    .eq("status", "active")
    .neq("declaration_source", "legacy")
    .maybeSingle();
  if (result.error) {
    return { asset: null, error: "The persona media library could not be verified." };
  }
  return {
    asset: result.data as ImageAsset | null,
    error: result.data ? "" : "Owned registered image not found.",
  };
}

async function ownedAssetByReference(
  admin: any,
  owner: string,
  personaId: string,
  reference: string,
) {
  const canonical = canonicalTransformObjectUrl(reference) || clean(reference);
  if (!canonical) return { asset: null, error: "This draft has no image." };
  const result = await admin.from("persona_media_assets")
    .select("id,persona_id,public_url,ai_use")
    .eq("owner", owner)
    .eq("persona_id", personaId)
    .eq("media_type", "image")
    .eq("status", "active")
    .neq("declaration_source", "legacy")
    .eq("public_url", canonical)
    .maybeSingle();
  if (result.error) {
    return { asset: null, error: "The persona media library could not be verified." };
  }
  return {
    asset: result.data as ImageAsset | null,
    error: result.data
      ? ""
      : "Import or prepare this image in the persona media library before asking a model to inspect it.",
  };
}

async function expectedSource(
  body: Record<string, unknown>,
  source: Omit<ImageTextSource, "bindingHash">,
  mediaUrl: string,
): Promise<ImageTextResolution> {
  const expectedAssetId = clean(body.expectedImageAssetId);
  const expectedRevision = clean(body.expectedRevision);
  const expectedHash = clean(body.expectedBindingHash).toLowerCase();
  const actualHash = await imageDraftBindingHash({
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    field: source.field,
    revision: source.sourceRevision,
    assetId: source.imageAssetId,
    mediaUrl,
  });
  if (
    !IMAGE_DRAFT_UUID.test(expectedAssetId) ||
    expectedAssetId !== source.imageAssetId ||
    expectedRevision !== source.sourceRevision ||
    !/^[0-9a-f]{64}$/.test(expectedHash) ||
    expectedHash !== actualHash
  ) {
    return {
      error:
        "The image or draft changed before analysis. Reload the saved draft and try again.",
      status: 409,
    };
  }
  return { source: { ...source, bindingHash: actualHash } };
}

export async function resolveImageTextSource(
  admin: any,
  owner: string,
  body: Record<string, unknown>,
): Promise<ImageTextResolution> {
  const sourceType = clean(body.sourceType);
  const sourceId = clean(body.sourceId);
  const field = clean(body.field);
  if (!IMAGE_DRAFT_UUID.test(sourceId) || !IMAGE_DRAFT_FIELDS.has(field)) {
    return { error: "A valid draft field is required.", status: 400 };
  }

  if (sourceType === "persona_media_asset") {
    if (field !== "brief") {
      return { error: "That field is not part of the initial three-channel brief.", status: 400 };
    }
    const found = await ownedAssetByOwnerId(admin, owner, sourceId);
    if (!found.asset) return { error: found.error, status: found.error.includes("verified") ? 500 : 404 };
    return await expectedSource(body, {
      sourceType,
      sourceId,
      sourceRevision: "",
      personaId: found.asset.persona_id,
      imageAssetId: found.asset.id,
      imageCrop: "",
      platform: "three-channel social post",
      field,
      context: "",
    }, found.asset.public_url);
  }

  if (sourceType === "owner_draft") {
    if (!new Set(["title", "body", "tags"]).has(field)) {
      return { error: "That field is not part of an owner Queue draft.", status: 400 };
    }
    const result = await admin.from("drafts")
      .select("id,owner,persona_id,platform,title,body,tags,media_url,media_asset_id,publish_state,provider_post_id,updated_at")
      .eq("id", sourceId)
      .eq("owner", owner)
      .maybeSingle();
    if (result.error) return { error: "The Queue draft could not be loaded.", status: 500 };
    const draft = result.data;
    if (!draft) return { error: "Owned Queue draft not found.", status: 404 };
    if (["publishing", "published"].includes(String(draft.publish_state)) || clean(draft.provider_post_id)) {
      return { error: "Published or provider-bound Queue history cannot be changed.", status: 409 };
    }
    if (!IMAGE_DRAFT_UUID.test(clean(draft.persona_id)) || !IMAGE_DRAFT_UUID.test(clean(draft.media_asset_id))) {
      return { error: "Save a registered persona image on this draft first.", status: 422 };
    }
    const found = await ownedAssetById(admin, owner, draft.persona_id, draft.media_asset_id);
    if (!found.asset) return { error: found.error, status: 422 };
    const reference = exactImageReferenceCrop(draft.media_url, found.asset.public_url, found.asset.ai_use, draft.platform);
    if (!reference.ok) return { error: reference.error, status: 422 };
    const context = [draft.title, draft.body, draft.tags].map(clean).filter(Boolean).join("\n");
    const draftPlatform = clean(draft.platform);
    return await expectedSource(body, {
      sourceType,
      sourceId,
      sourceRevision: clean(draft.updated_at),
      personaId: draft.persona_id,
      imageAssetId: found.asset.id,
      imageCrop: reference.crop,
      platform: draftPlatform === "twitter" ? "x" : draftPlatform || "aliaspaces",
      field,
      context: context.slice(0, 4000),
    }, clean(draft.media_url));
  }

  if (sourceType === "post_draft") {
    if (!new Set(["fb_caption", "ig_caption", "x_caption"]).has(field)) {
      return { error: "That field is not part of a three-channel post draft.", status: 400 };
    }
    const result = await admin.from("post_drafts")
      .select("id,owner,persona_id,status,brief,source_image_url,fb_image_url,ig_image_url,x_image_url,source_media_asset_id,fb_media_asset_id,ig_media_asset_id,x_media_asset_id,fb_post_id,ig_media_id,x_tweet_id,updated_at")
      .eq("id", sourceId)
      .eq("owner", owner)
      .maybeSingle();
    if (result.error) return { error: "The post draft could not be loaded.", status: 500 };
    const draft = result.data;
    if (!draft) return { error: "Owned post draft not found.", status: 404 };
    if (!['draft', 'failed'].includes(String(draft.status)) || draft.fb_post_id || draft.ig_media_id || draft.x_tweet_id) {
      return { error: "Unschedule or create a fresh editable draft before generating new copy.", status: 409 };
    }
    const platform = field === "fb_caption" ? "facebook" : field === "ig_caption" ? "instagram" : "x";
    const platformAssetId = platform === "facebook" ? draft.fb_media_asset_id : platform === "instagram" ? draft.ig_media_asset_id : draft.x_media_asset_id;
    const displayUrl = platform === "facebook" ? (draft.fb_image_url || draft.source_image_url) : platform === "instagram" ? (draft.ig_image_url || draft.source_image_url) : (draft.x_image_url || draft.source_image_url);
    const found = await ownedAssetById(admin, owner, draft.persona_id, clean(platformAssetId || draft.source_media_asset_id));
    if (!found.asset) return { error: found.error, status: 422 };
    const reference = exactImageReferenceCrop(displayUrl, found.asset.public_url, found.asset.ai_use, platform);
    if (!reference.ok) return { error: reference.error, status: 422 };
    return await expectedSource(body, {
      sourceType,
      sourceId,
      sourceRevision: clean(draft.updated_at),
      personaId: draft.persona_id,
      imageAssetId: found.asset.id,
      imageCrop: reference.crop,
      platform,
      field,
      context: clean(draft.brief).slice(0, 4000),
    }, clean(displayUrl));
  }

  if (sourceType === "content_variant") {
    if (!new Set(["title", "body", "description", "alt_text"]).has(field)) {
      return { error: "That field is not part of a four-channel content variant.", status: 400 };
    }
    const result = await admin.from("persona_content_variants")
      .select("id,owner,persona_id,package_id,channel,title,body,description,media_plan,status,provider_id,provider_url,updated_at")
      .eq("id", sourceId)
      .eq("owner", owner)
      .maybeSingle();
    if (result.error) return { error: "The content variant could not be loaded.", status: 500 };
    const variant = result.data;
    if (!variant) return { error: "Owned content variant not found.", status: 404 };
    if (!['ready', 'approved'].includes(String(variant.status)) || clean(variant.provider_id) || clean(variant.provider_url)) {
      return { error: "Posted or provider-bound content cannot generate replacement copy.", status: 409 };
    }
    const packResult = await admin.from("persona_content_packages")
      .select("id,status,title,owner_guidance")
      .eq("id", variant.package_id)
      .eq("owner", owner)
      .eq("persona_id", variant.persona_id)
      .maybeSingle();
    if (packResult.error) return { error: "The content package could not be loaded.", status: 500 };
    if (!packResult.data || !['owner_review', 'approved'].includes(String(packResult.data.status))) {
      return { error: "Unschedule this package before generating new copy.", status: 409 };
    }
    const media = Array.isArray(variant.media_plan) ? variant.media_plan : [];
    const firstImage = media.find((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return String(record.type || "image") === "image" && clean(record.source_url);
    }) as Record<string, unknown> | undefined;
    const displayUrl = clean(firstImage?.source_url);
    const found = await ownedAssetByReference(admin, owner, variant.persona_id, displayUrl);
    if (!found.asset) return { error: found.error, status: 422 };
    const reference = exactImageReferenceCrop(displayUrl, found.asset.public_url, found.asset.ai_use, variant.channel);
    if (!reference.ok) return { error: reference.error, status: 422 };
    const context = [
      packResult.data.title,
      packResult.data.owner_guidance,
      variant.title,
      variant.body,
      variant.description,
    ].map(clean).filter(Boolean).join("\n");
    return await expectedSource(body, {
      sourceType,
      sourceId,
      sourceRevision: clean(variant.updated_at),
      personaId: variant.persona_id,
      imageAssetId: found.asset.id,
      imageCrop: reference.crop,
      platform: clean(variant.channel),
      field,
      context: context.slice(0, 4000),
    }, displayUrl);
  }

  return { error: "Unsupported draft source.", status: 400 };
}

export async function revalidateImageTextSource(
  admin: any,
  owner: string,
  body: Record<string, unknown>,
  expected: ImageTextSource,
) {
  const live = await resolveImageTextSource(admin, owner, body);
  if (!live.source) {
    throw new ImageDraftActionError(
      live.error || "The image source could not be revalidated.",
      live.status || 409,
    );
  }
  const same =
    live.source.sourceType === expected.sourceType &&
    live.source.sourceId === expected.sourceId &&
    live.source.sourceRevision === expected.sourceRevision &&
    live.source.bindingHash === expected.bindingHash &&
    live.source.personaId === expected.personaId &&
    live.source.imageAssetId === expected.imageAssetId &&
    live.source.imageCrop === expected.imageCrop &&
    live.source.platform === expected.platform &&
    live.source.field === expected.field &&
    live.source.context === expected.context;
  if (!same) {
    throw new ImageDraftActionError(
      "The image or draft changed before provider disclosure. Reload and try again.",
      409,
    );
  }
  return live.source;
}

export async function runImageTextDraft(options: {
  admin: any;
  owner: string;
  body: Record<string, unknown>;
  generate: (source: ImageTextSource, backendId: string) => Promise<string>;
}) {
  const first = await resolveImageTextSource(options.admin, options.owner, options.body);
  if (!first.source) throw new ImageDraftActionError(first.error || "The registered image could not be resolved.", first.status || 400);

  const personaResult = await options.admin.from("personas")
    .select("id,owner,ai_backend")
    .eq("id", first.source.personaId)
    .eq("owner", options.owner)
    .maybeSingle();
  if (personaResult.error) throw new ImageDraftActionError("The persona model could not be loaded.", 500);
  const backendId = clean(personaResult.data?.ai_backend);
  if (!personaResult.data || !IMAGE_DRAFT_UUID.test(backendId)) {
    throw new ImageDraftActionError("Link a vision-capable AI model to this persona first.", 422);
  }

  const live = await revalidateImageTextSource(
    options.admin,
    options.owner,
    options.body,
    first.source,
  );
  const text = await options.generate(live, backendId);
  return { source: live, text };
}

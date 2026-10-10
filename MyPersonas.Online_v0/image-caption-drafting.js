(function (root) {
  "use strict";

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const CROPS = Object.freeze({
    facebook: Object.freeze({ width: 1200, height: 628 }),
    instagram: Object.freeze({ width: 1080, height: 1080 }),
    x: Object.freeze({ width: 1080, height: 1350 }),
  });

  function clean(value) { return String(value || "").trim(); }

  function firstVisibleImage(mediaPlan) {
    return (Array.isArray(mediaPlan) ? mediaPlan : []).find((item) => item
      && typeof item === "object"
      && String(item.type || "image") === "image"
      && clean(item.source_url)) || null;
  }

  function transformObjectUrl(reference) {
    try {
      const url = new URL(reference);
      const marker = "/storage/v1/render/image/public/";
      if (url.protocol !== "https:" || url.username || url.password || url.hash || !url.pathname.includes(marker)) return "";
      url.pathname = url.pathname.replace(marker, "/storage/v1/object/public/");
      url.search = "";
      return url.toString();
    } catch (_) { return ""; }
  }

  function exactRegisteredBinding(reference, personaId, platform, assets) {
    const shown = clean(reference);
    const candidates = (Array.isArray(assets) ? assets : []).filter((asset) => asset
      && clean(asset.persona_id) === clean(personaId)
      && clean(asset.status || "active") === "active"
      && clean(asset.media_type || "image") === "image"
      && UUID.test(clean(asset.id)));
    let asset = candidates.find((row) => clean(row.public_url) === shown) || null;
    if (asset) return { url: shown, assetId: clean(asset.id), crop: "" };

    const objectUrl = transformObjectUrl(shown);
    asset = candidates.find((row) => clean(row.public_url) === objectUrl && clean(row.ai_use) === "none") || null;
    if (!asset) return null;
    const key = platform === "twitter" ? "x" : clean(platform);
    const crop = CROPS[key];
    if (!crop) return null;
    try {
      const url = new URL(shown), allowed = new Set(["width", "height", "resize", "quality", "format"]), seen = new Set();
      for (const [name, value] of url.searchParams.entries()) {
        if (!allowed.has(name) || seen.has(name)) return null;
        seen.add(name);
        if (name === "quality" && !/^(?:[2-9][0-9]|100)$/.test(value)) return null;
        if (name === "format" && !["origin", "webp"].includes(value)) return null;
      }
      if (url.searchParams.get("width") !== String(crop.width)
          || url.searchParams.get("height") !== String(crop.height)
          || url.searchParams.get("resize") !== "cover") return null;
    } catch (_) { return null; }
    return { url: shown, assetId: clean(asset.id), crop: key };
  }

  async function bindingHash({ sourceType, sourceId, field, revision, assetId, mediaUrl }) {
    const bytes = new TextEncoder().encode(JSON.stringify([
      clean(sourceType), clean(sourceId), clean(field), clean(revision), clean(assetId), clean(mediaUrl),
    ]));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function requestPrecondition({ sourceType, sourceId, field, revision = "", assetId, mediaUrl }) {
    const expectedImageAssetId = clean(assetId);
    if (!UUID.test(expectedImageAssetId)) throw new Error("Reload this draft before generating from its registered image");
    const expectedRevision = clean(revision);
    return {
      expectedImageAssetId,
      expectedRevision,
      expectedBindingHash: await bindingHash({
        sourceType, sourceId, field, revision: expectedRevision, assetId: expectedImageAssetId, mediaUrl,
      }),
    };
  }

  function verifyResponse(result, request) {
    const precondition = request?.precondition || {};
    return !!result
      && result.sourceType === request.sourceType
      && result.sourceId === request.sourceId
      && result.field === request.field
      && result.sourceRevision === precondition.expectedRevision
      && result.bindingHash === precondition.expectedBindingHash
      && result.imageAssetId === precondition.expectedImageAssetId
      && result.saved === false
      && result.approved === false
      && typeof result.text === "string"
      && !!result.text.trim();
  }

  function setModalDirty(modal, dirty = true) {
    if (!modal) return false;
    modal.dataset.imageDraftDirty = dirty ? "true" : "false";
    for (const control of modal.querySelectorAll("[data-requires-saved-kit]")) {
      control.disabled = !!dirty;
      control.setAttribute("aria-disabled", String(!!dirty));
      if (dirty) control.title = "Save and reload this changed kit before using this action";
    }
    const notice = modal.querySelector("[data-image-draft-dirty-notice]");
    if (notice) notice.hidden = !dirty;
    return true;
  }

  root.MyPersonasImageCaptionDrafting = Object.freeze({
    bindingHash,
    exactRegisteredBinding,
    firstVisibleImage,
    requestPrecondition,
    setModalDirty,
    verifyResponse,
  });
})(typeof window === "object" ? window : globalThis);

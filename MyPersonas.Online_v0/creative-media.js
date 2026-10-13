/* Shared validation for the private website library. No persistence or credentials. */
(function (root) {
  "use strict";
  const MAX_BYTES = 50 * 1024 * 1024;
  const TYPES = Object.freeze({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/mp4": "m4a" });
  const SOURCES = Object.freeze(["upload", "soul_concept", "davinci", "foxy", "higgsfield", "freebeat", "openart", "other"]);
  const uuid = value => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value || "");
  function fileType(file) {
    if (!TYPES[file?.type] || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_BYTES) throw new Error("Choose a supported image, video or audio file up to 50 MB. SVG and project archives are not media uploads.");
    return { mime: file.type, kind: file.type.split("/")[0], extension: TYPES[file.type] };
  }
  function providerUrl(value) {
    try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "cdn.openart.ai" && !u.port && !u.username && !u.password ? u.href : ""; } catch { return ""; }
  }
  function validateBytes(type, buffer) {
    const b = new Uint8Array(buffer), at = (offset, values) => values.every((n,i) => b[offset+i] === n), text = (offset, s) => at(offset, Array.from(s, c => c.charCodeAt(0)));
    const valid = type === "image/png" ? at(0,[137,80,78,71,13,10,26,10]) : type === "image/jpeg" ? at(0,[255,216,255]) :
      type === "image/webp" ? text(0,"RIFF") && text(8,"WEBP") : type === "video/webm" ? at(0,[26,69,223,163]) :
      ["video/mp4","audio/mp4"].includes(type) ? text(4,"ftyp") : ["audio/wav","audio/x-wav"].includes(type) ? text(0,"RIFF") && text(8,"WAVE") :
      type === "audio/ogg" ? text(0,"OggS") : type === "audio/mpeg" ? text(0,"ID3") || (b[0] === 255 && (b[1] & 224) === 224) : false;
    if (!valid) throw new Error("The file contents do not match its media type. Export a supported media file from the source tool.");
  }
  function unpack(result) {
    if (result?.structuredContent && typeof result.structuredContent === "object") return result.structuredContent;
    for (const block of result?.content || []) if (block.type === "text") { try { const v = JSON.parse(block.text); if (v && !Array.isArray(v) && typeof v === "object") return v; } catch {} }
    throw new Error("OpenArt returned an unsupported response. Your request has not been retried.");
  }
  function modes(catalog) {
    return (catalog?.models || []).flatMap(model => Object.entries(model.modes || {}).flatMap(([media, list]) =>
      ["image", "video"].includes(media) && Array.isArray(list) ? list.map(mode => ({ model: model.id, label: model.displayName, description: mode.description || model.description, media, ...mode })) : []));
  }
  function metadata(input, owner, personas) {
    if (!uuid(owner)) throw new Error("Sign in before importing media.");
    if (input.persona_id && !personas.some(p => p.id === input.persona_id && p.owner === owner)) throw new Error("Select an owned persona.");
    if (!SOURCES.includes(input.source_tool)) throw new Error("Choose a source tool.");
    if (!input.title?.trim() || input.title.length > 200) throw new Error("Add a title up to 200 characters.");
    if (input.rights_confirmed !== true) throw new Error("Confirm your right to store this file and any depicted likeness.");
    return { owner, persona_id: input.persona_id || null, title: input.title.trim(), source_tool: input.source_tool,
      alt_text: String(input.alt_text || "").slice(0, 2000), project: String(input.project || "").slice(0, 120),
      notes: String(input.notes || "").slice(0, 4000), rights_confirmed: true, training_allowed: false,
      parent_id: input.parent_id || null, review_status: "unreviewed" };
  }
  function filter(items, { query = "", kind = "", source = "", persona = "" } = {}) {
    const term = query.trim().toLowerCase();
    return items.filter(x => (!kind || x.kind === kind) && (!source || x.source_tool === source) && (!persona || x.persona_id === persona) &&
      (!term || [x.title, x.project, x.notes, x.alt_text].join(" ").toLowerCase().includes(term)));
  }
  root.CreativeMedia = Object.freeze({ MAX_BYTES, TYPES, SOURCES, uuid, fileType, validateBytes, providerUrl, unpack, modes, metadata, filter });
})(globalThis);

"use strict";
// Owner-only website orchestration. Local engines and identity packages remain in Soulular.
const creativeState = { generation: 0, revision: 0, formRequest: 0, owner: "", assets: [], jobs: [], projects: [], modes: [], creations: [], quote: null, form: null, selectedMode: null, urls: [], page: 0, more: false };
function creativeReset() {
  creativeState.generation++;
  for (const url of creativeState.urls) URL.revokeObjectURL(url);
  Object.assign(creativeState, { owner: "", assets: [], jobs: [], projects: [], modes: [], creations: [], quote: null, form: null, selectedMode: null, urls: [], page: 0, more: false });
}
function creativeContext() {
  if (!session?.user?.id || !privateSessionReady) throw new Error("Sign in and complete account security to open your workspace.");
  if (typeof ownerAppIsPersonaMode === "function" && ownerAppIsPersonaMode()) throw new Error("Switch to Overview for your private creative workspace.");
  return { owner: session.user.id, generation: creativeState.generation, route: location.hash };
}
function creativeCurrent(ctx) { return session?.user?.id === ctx.owner && privateSessionReady && creativeState.generation === ctx.generation && location.hash === ctx.route; }
function creativeAssert(ctx) { if (!creativeCurrent(ctx)) throw new Error("The workspace changed. Reopen it before continuing."); }
function creativeStatus(message) { const node = document.getElementById("creativeStatus"); if (node) node.textContent = message; }
async function creativeAction(button, task) {
  let ctx;
  try { ctx = creativeContext(); }
  catch (error) { creativeStatus(error.message || "Reopen your signed-in private workspace before continuing."); return; }
  if (button) button.disabled = true;
  try { await task(ctx); } catch (e) { if (creativeCurrent(ctx)) creativeStatus(e.message || "The operation could not finish. Refresh before trying again."); }
  finally { if (button?.isConnected && creativeCurrent(ctx)) button.disabled = false; }
}
async function creativeInvoke(name, body, ctx) {
  creativeAssert(ctx);
  if (!navigator.onLine) throw new Error("Reconnect to use your private workspace. No private data is available offline.");
  const result = await sb.functions.invoke(name, { body });
  creativeAssert(ctx);
  if (result.error) {
    let message = "This connection is unavailable. Check sign-in, MFA, and the deployed service before retrying.";
    try { const data = await result.error.context?.json(); if (typeof data?.error === "string") message = data.error; } catch {}
    throw new Error(message);
  }
  if (result.data?.error) throw new Error(result.data.error);
  return result.data;
}
function creativeNav(view) {
  return `<nav class="cw-nav" aria-label="Creative workspace"><a href="#/owner">Personas</a><a href="#/create" ${view === "create" ? 'aria-current="page"' : ""}>Create</a><a href="#/library" ${view === "library" ? 'aria-current="page"' : ""}>Library</a><a href="#/schedule">Review drafts</a></nav>`;
}
function creativePersonaOptions(selected = "") { return '<option value="">Unassigned</option>' + (myPersonas || []).filter(p => p.owner === session.user.id).map(p => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.name)}</option>`).join(""); }
function creativeSources() { return CreativeMedia.SOURCES.map(x => `<option value="${x}">${esc(CreativeMedia.sourceLabel(x))}</option>`).join(""); }
function renderCreativeLanding() {
  app.innerHTML = `<div class="cw-shell cw-landing"><section class="cw-hero"><div><span class="cw-kicker">MyPersonas · Your creative home</span><h2>Every persona.<br>A place to create.</h2><p>Bring your ideas, references, and creative work together. Keep each persona's voice in focus as you move from an early concept to a carefully reviewed draft.</p><div class="cw-actions"><button class="cw-primary" onclick="go('signin')">Open your workspace</button><button onclick="go('search/')">Explore AliaSpaces personas</button></div></div><div class="cw-orbit" aria-hidden="true"><span>IDEA</span><b>Make it<br>your own.</b><span>CREATE · COLLECT · REVIEW</span></div></section><div class="cw-dashboard"><a href="#/signin"><b>Choose your persona</b><small>Your owned roster, voice, and references.</small></a><a href="#/signin"><b>Bring your creative work</b><small>Images, video, and audio from the tools you use.</small></a><a href="#/signin"><b>Review with intention</b><small>Private drafts and exact previews. Approval never sends a post.</small></a></div><section class="cw-panel"><h3>Your tools. A connected workflow.</h3><p class="cw-muted">MyPersonas is your private owner workspace. AliaSpaces is the persona-facing social experience. Local creative assets and generation stay in your desktop studio unless you explicitly choose to import a file.</p><p class="cw-muted">Creative workspace availability depends on your account and the installed release. Sign in to check your connections.</p></section></div>`;
}
function creativeImportForm() {
  return `<details class="cw-panel" id="creativeImport"><summary>Import a finished asset</summary><p class="cw-muted">Choose a file you exported from your creative tool. This copies only the selected file into your private website library. It does not sync your desktop library or permit training.</p>
    <form id="creativeImportForm"><div class="cw-row"><label>File · up to 50 MB<input name="file" type="file" accept="${Object.keys(CreativeMedia.TYPES).join(",")}" required></label><label>Title<input name="title" maxlength="200" required></label></div>
    <div class="cw-row"><label>Created with<select name="source_tool">${creativeSources()}</select></label><label>Persona<select name="persona_id">${creativePersonaOptions(ownerAppState.selectedPersonaId)}</select></label><label>Project<input name="project" maxlength="120" placeholder="Campaign or collection"></label></div>
    <label>Description / alt text<textarea name="alt_text" maxlength="2000" placeholder="Describe what someone should understand from this asset"></textarea></label><label>Notes<textarea name="notes" maxlength="4000" placeholder="Editing notes, source project, or version changes"></textarea></label>
    <label>New version of<select name="parent_id"><option value="">New asset</option>${creativeState.assets.map(x => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join("")}</select></label>
    <label class="cw-check"><input name="rights" type="checkbox" required>I have permission to store this media and any depicted likeness here. This is not training or publication permission.</label>
    <div class="cw-actions"><button class="cw-primary" type="submit">Import into private library</button></div></form></details>`;
}
function creativeAssetCards() {
  const rows = CreativeMedia.filter(creativeState.assets, { query: document.getElementById("creativeSearch")?.value, kind: document.getElementById("creativeKind")?.value, source: document.getElementById("creativeSource")?.value, persona: document.getElementById("creativePersona")?.value });
  document.getElementById("creativeAssets").innerHTML = rows.length ? rows.map(x => `<article class="cw-asset"><div class="cw-art" aria-hidden="true">${x.kind === "image" ? "▧" : x.kind === "video" ? "▷" : "♫"}</div><div class="cw-asset-body"><span class="cw-tag">${esc(CreativeMedia.sourceLabel(x.source_tool))} · ${esc(x.kind)}</span><h3>${esc(x.title)}</h3><p class="cw-muted">${esc(x.project || "No project")} · ${x.source_url ? "Provider-hosted reference" : "Private file"}${x.parent_id ? " · New version" : ""}</p><p class="cw-muted">${esc(x.alt_text || "Description needed")}<br>Unreviewed · training not permitted</p><button data-asset="${esc(x.id)}">Open &amp; describe</button></div></article>`).join("") : '<div class="cw-empty"><h3>A home for your creative work</h3><p>Import a finished image, clip, or audio file—or save an OpenArt result. Try clearing filters if you have already imported files.</p></div>';
  document.querySelectorAll("[data-asset]").forEach(b => b.onclick = () => creativeAction(b, ctx => creativeOpenAsset(b.dataset.asset, ctx)));
}
async function renderCreativeWorkspace(view) {
  if (!session || !privateSessionReady) { renderSignin(); return; }
  creativeReset(); creativeState.owner = session.user.id;
  const ctx = creativeContext();
  app.innerHTML = `<div class="cw-shell">${creativeNav(view)}<section class="cw-hero"><div><span class="cw-kicker">MyPersonas · Private creative workspace</span><h2>${view === "library" ? "Your work, together." : "Make something in character."}</h2><p>${view === "library" ? "Keep your selected images, clips, and audio together across creative tools. Organize by persona and project, then bring your ideas into review." : "Choose a persona, shape the brief, and work with OpenArt. Every result starts private and unreviewed."}</p></div></section><div id="creativeStatus" class="cw-status" role="status" aria-live="polite"></div><div id="creativeContent"><p>Loading your workspace…</p></div></div>`;
  try { if (view === "library") await creativeLoadLibrary(ctx); else await creativeLoadCreate(ctx); }
  catch (e) { if (creativeCurrent(ctx)) { document.getElementById("creativeContent").innerHTML = '<div class="cw-empty"><h3>Workspace unavailable</h3><p>Your files have not been replaced with sample data.</p><button onclick="renderCreativeWorkspace(location.hash===\'#/library\'?\'library\':\'create\')">Try again</button></div>'; creativeStatus(e.message); } }
}
async function creativeLoadLibrary(ctx, append = false) {
  const result = await sb.from("owner_media_library").select("*").eq("owner", ctx.owner).order("created_at", { ascending: false }).order("id").range(creativeState.page * 100, creativeState.page * 100 + 99);
  creativeAssert(ctx);
  if (result.error) throw new Error("The private media library is not ready on this server. Its reviewed database and storage migration must be released first.");
  for (const url of creativeState.urls) URL.revokeObjectURL(url); creativeState.urls = [];
  creativeState.assets = append ? [...creativeState.assets, ...result.data] : result.data;
  creativeState.more = result.data.length === 100;
  document.getElementById("creativeContent").innerHTML = `${creativeImportForm()}<section class="cw-panel"><div class="cw-row"><label>Search loaded assets<input id="creativeSearch" type="search" placeholder="Title, project, notes…"></label><label>Type<select id="creativeKind"><option value="">All media</option><option>image</option><option>video</option><option>audio</option></select></label><label>Source<select id="creativeSource"><option value="">Every tool</option>${creativeSources()}</select></label><label>Persona<select id="creativePersona">${creativePersonaOptions()}</select></label></div></section><div id="creativeAssets" class="cw-grid"></div><div class="cw-actions">${creativeState.more ? '<button id="creativeMore">Load 100 more</button>' : ""}<span class="cw-muted">${creativeState.assets.length} loaded · shared across your workflows, private to your account</span></div><section id="creativeDetail"></section>`;
  document.querySelector("#creativePersona option").textContent = "All personas";
  for (const id of ["creativeSearch", "creativeKind", "creativeSource", "creativePersona"]) document.getElementById(id).oninput = creativeAssetCards;
  document.getElementById("creativeImportForm").onsubmit = e => { e.preventDefault(); creativeAction(e.submitter, ctx => creativeUpload(e.target, ctx)); };
  if (creativeState.more) document.getElementById("creativeMore").onclick = e => creativeAction(e.target, async ctx => { creativeState.page++; try { await creativeLoadLibrary(ctx, true); } catch (e) { creativeState.page--; throw e; } });
  creativeAssetCards();
}
async function creativeUpload(form, ctx) {
  const data = new FormData(form), file = data.get("file"), type = CreativeMedia.fileType(file);
  const meta = CreativeMedia.metadata({ ...Object.fromEntries(data), rights_confirmed: data.get("rights") === "on" }, ctx.owner, myPersonas);
  const bytes = await file.arrayBuffer(); CreativeMedia.validateBytes(type.mime, bytes);
  const digest = await crypto.subtle.digest("SHA-256", bytes); creativeAssert(ctx);
  const sha256 = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  const existing = await sb.from("owner_media_library").select("id,title").eq("owner", ctx.owner).eq("sha256", sha256).maybeSingle(); creativeAssert(ctx);
  if (existing.error) throw new Error("The library is not ready. Nothing was uploaded.");
  if (existing.data) throw new Error(`This file is already in your library: ${existing.data.title}`);
  const id = crypto.randomUUID(), storage_path = `${ctx.owner}/${id}`;
  creativeStatus("Uploading your private file…");
  const upload = await sb.storage.from("creative-private").upload(storage_path, file, { contentType: type.mime, upsert: false, cacheControl: "0" });
  creativeAssert(ctx); if (upload.error) throw new Error("Upload failed. Check the connection and file type; no library entry was created.");
  const saved = await sb.from("owner_media_library").insert({ ...meta, id, storage_path, sha256, kind: type.kind, mime: type.mime, byte_size: file.size }); creativeAssert(ctx);
  if (saved.error) { const cleanup = await sb.storage.from("creative-private").remove([storage_path]); throw new Error(cleanup.error ? "The file uploaded but its entry failed. Storage cleanup also failed; contact support with this file id: " + id : "The library entry could not be saved. The uploaded copy was removed."); }
  creativeState.page = 0; await creativeLoadLibrary(ctx); creativeStatus("Imported privately. The asset is unreviewed and has no training permission.");
}
async function creativeOpenAsset(id, ctx) {
  const asset = creativeState.assets.find(x => x.id === id && x.owner === ctx.owner); if (!asset) throw new Error("This asset is not in your library.");
  for (const old of creativeState.urls) URL.revokeObjectURL(old); creativeState.urls = [];
  let url = "";
  if (asset.storage_path) {
    const res = await sb.storage.from("creative-private").download(asset.storage_path); creativeAssert(ctx);
    if (res.error) throw new Error("This file could not be opened. Refresh the library and try again.");
    url = URL.createObjectURL(res.data); creativeState.urls.push(url);
  }
  const pane = document.getElementById("creativeDetail");
  pane.innerHTML = `<div class="cw-panel" style="margin-top:24px"><h3>${esc(asset.title)}</h3>${url ? asset.kind === "image" ? `<img class="cw-preview" src="${esc(url)}" alt="${esc(asset.alt_text)}">` : `<${asset.kind} class="cw-preview" src="${esc(url)}" controls preload="metadata"></${asset.kind}>` : `<p class="cw-notice">This is a provider-hosted reference, not a private file copy. Opening it contacts OpenArt. Download it there and import the file here if you need a retained copy.</p><a href="${esc(CreativeMedia.providerUrl(asset.source_url))}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open selected OpenArt result</a>`}
    ${url ? `<p><a href="${esc(url)}" download="${esc(asset.title)}.${esc(CreativeMedia.TYPES[asset.mime] || 'bin')}">Download private copy</a></p>` : ""}
    <form id="creativeEdit" data-asset-id="${esc(id)}"><label>Title<input name="title" maxlength="200" value="${esc(asset.title)}" required></label><div class="cw-row"><label>Project<input name="project" maxlength="120" value="${esc(asset.project)}"></label><label>Persona<select name="persona_id">${creativePersonaOptions(asset.persona_id)}</select></label></div><label>Description / alt text<textarea name="alt_text" maxlength="2000">${esc(asset.alt_text)}</textarea></label><label>Notes<textarea name="notes" maxlength="4000">${esc(asset.notes)}</textarea></label><div class="cw-actions"><button type="submit" class="cw-primary">Save description</button><button type="button" id="creativeDraft">Start a private text draft</button><button type="button" id="creativeRemove">Remove from library</button></div></form><p class="cw-muted">Text drafts can reference this asset by title and ID. Media attachment and media approval are not enabled in the four-channel mobile milestone.</p></div>`;
  pane.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("creativeEdit").onsubmit = e => { e.preventDefault(); creativeAction(e.submitter, async ctx => {
    const input = Object.fromEntries(new FormData(e.target)); const meta = CreativeMedia.metadata({ ...asset, ...input, rights_confirmed: true }, ctx.owner, myPersonas);
    const changes = { title: meta.title, project: meta.project, persona_id: meta.persona_id, alt_text: meta.alt_text, notes: meta.notes };
    const r = await sb.from("owner_media_library").update(changes).eq("id", id).eq("owner", ctx.owner).select("id"); creativeAssert(ctx);
    if (r.error || r.data?.length !== 1) throw new Error("Description could not be saved."); Object.assign(asset, changes); creativeAssetCards(); creativeStatus("Description saved. Approval remains separate.");
  }); };
  const continuation = document.createElement("div");
  continuation.className = "cw-notice";
  continuation.innerHTML = `<b>Continue with this saved asset</b><p>From ${esc(CreativeMedia.sourceLabel(asset.source_tool))} → your private MyPersonas draft → separate AliaSpaces page review. Save any changes first. Only the reference title, ID, source and description enter the text draft; media stays private. Training and publishing stay off.</p><button type="button" id="creativePage">View assigned AliaSpaces page</button><p class="cw-muted">Viewing a page does not publish it or attach this asset.</p>`;
  pane.appendChild(continuation);
  document.getElementById("creativeDraft").onclick = e => creativeContinueAsset(id, ctx, e.target, "draft");
  document.getElementById("creativePage").onclick = e => creativeContinueAsset(id, ctx, e.target, "page");
  document.getElementById("creativeRemove").onclick = e => creativeAction(e.target, async ctx => {
    if (!confirm("Remove this library entry" + (asset.storage_path ? " and its private file copy" : "") + "? Original files in your creative tool are unaffected.")) return;
    if (asset.storage_path) { const r = await sb.storage.from("creative-private").remove([asset.storage_path]); creativeAssert(ctx); if (r.error) throw new Error("File removal failed. The library entry was retained."); }
    const r = await sb.from("owner_media_library").delete().eq("id", id).eq("owner", ctx.owner).select("id"); creativeAssert(ctx);
    if (r.error || r.data?.length !== 1) throw new Error("The entry could not be removed. Refresh and retry entry cleanup."); creativeState.page = 0; await creativeLoadLibrary(ctx); creativeStatus("Removed from your library.");
  });
}
function creativeContinueAsset(id, openedContext, button, destination) {
  return creativeAction(button, async ctx => {
    creativeAssert(openedContext);
    const asset = creativeState.assets.find(row => row.id === id && row.owner === ctx.owner);
    const form = document.getElementById("creativeEdit");
    if (!form || form.dataset.assetId !== id) throw new Error("Reopen the saved asset before continuing.");
    const plan = CreativeMedia.handoff(asset, ctx.owner, myPersonas, Object.fromEntries(new FormData(form)));
    if (destination === "page") {
      if (!plan.pageRoute) throw new Error("This persona has no saved AliaSpaces handle. Open its owner settings first.");
      go(plan.pageRoute);
    } else if (destination === "draft") {
      if (document.getElementById("ownerPrivateDraftModal")) throw new Error("Finish or cancel the open private draft before starting another.");
      ownerAppOpenPrivateDraft(plan.personaId);
      const guidance = document.getElementById("ownerMobileDraftGuidance");
      if (guidance && document.getElementById("ownerPrivateDraftModal")) guidance.value = plan.guidance;
    }
  });
}
async function creativeLoadCreate(ctx) {
  document.getElementById("creativeContent").innerHTML = `<section class="cw-panel"><h3>OpenArt</h3><p class="cw-muted">Use your own OpenArt projects and credits. Connecting does not generate anything.</p><div id="creativeConnection">Checking connection…</div><div class="cw-actions"><button id="creativeConnect">Connect / reconnect OpenArt</button><button id="creativeRefresh">Refresh workspace</button><button id="creativeDisconnect">Disconnect</button></div></section><div id="creativeComposer"></div><section class="cw-panel"><h3>Recent generations</h3><div id="creativeJobs">Load your connection to see generation history.</div></section><section class="cw-panel"><h3>Bring your existing work</h3><p>Export a file from Soulular / Soul Concept, DaVinci, Foxy, Higgsfield, or Freebeat and import it into your library. Desktop projects and original files stay in their current home.</p><a href="#/library">Open media library →</a><p class="cw-muted">Higgsfield and Freebeat generation connectors are planned after this OpenArt workflow.</p></section>`;
  document.getElementById("creativeConnect").onclick = e => creativeAction(e.target, async ctx => { const r = await creativeInvoke("openart-connect", { action: "start" }, ctx); const u = new URL(r.url); if (u.protocol !== "https:" || u.hostname !== "openart.ai" || u.username || u.password || u.port) throw new Error("The authorization destination was not recognized."); location.assign(u.href); });
  document.getElementById("creativeRefresh").onclick = () => renderCreativeWorkspace("create");
  document.getElementById("creativeDisconnect").onclick = e => creativeAction(e.target, async ctx => { if (!confirm("Disconnect MyPersonas from OpenArt? Existing files in OpenArt are retained.")) return; await creativeInvoke("openart-connect", { action: "disconnect" }, ctx); await renderCreativeWorkspace("create"); });
  try {
    const status = await creativeInvoke("openart-connect", { action: "status" }, ctx);
    document.getElementById("creativeConnection").textContent = status.connected ? "Connected · ready to load projects" : "Not connected. Connect your account to browse models and projects.";
    if (!status.connected) return;
    const results = await Promise.all([creativeInvoke("openart-library", { action: "projects" }, ctx), creativeInvoke("openart-library", { action: "models" }, ctx), creativeInvoke("openart-jobs", { action: "list" }, ctx)]);
    const projects = CreativeMedia.unpack(results[0].result), catalog = CreativeMedia.unpack(results[1].result);
    creativeState.projects = projects.items || []; creativeState.projectCursor = projects.nextCursor; creativeState.modes = CreativeMedia.modes(catalog); creativeState.jobs = results[2].jobs || [];
    creativeComposer(catalog); creativeJobs();
  } catch (e) { creativeAssert(ctx); document.getElementById("creativeConnection").textContent = "Connection needs attention."; creativeStatus(e.message); }
}
function creativeComposer(catalog) {
  creativeClearQuote(); creativeState.formRequest++; creativeState.form = null; creativeState.selectedMode = null;
  document.getElementById("creativeComposer").innerHTML = `<div class="cw-split"><section class="cw-panel"><h3>Shape your next piece</h3><label>Persona<select id="creativeActor">${creativePersonaOptions(ownerAppState.selectedPersonaId)}</select></label><label>OpenArt project<select id="creativeProject">${creativeState.projects.map((p,i) => `<option value="${i}">${esc(p.name)}${p.canGenerate ? "" : " · browse only"}</option>`).join("")}</select></label><div class="cw-actions"><button id="creativeBrowse">Browse project creations</button>${creativeState.projectCursor ? '<button id="creativeProjectMore">Load more projects</button>' : ""}</div><label>Model &amp; operation<select id="creativeModel"><option value="">Choose what to create</option>${creativeState.modes.map((m,i) => `<option value="${i}">${esc(m.label)} · ${esc(m.mode)}${m.affordable === false ? " · insufficient credits" : ""}</option>`).join("")}</select></label><div id="creativeModelFields"><p class="cw-muted">Model settings load directly from your OpenArt connection.</p></div><div id="creativeQuote"></div></section><aside class="cw-panel"><h3>Your creative brief</h3><p class="cw-muted">Choose only the references you want sent to OpenArt. Private persona memories, desktop photos and training data are never added automatically.</p><p>${typeof catalog.balance === "number" ? esc(catalog.balance) + " OpenArt credits available" : "Balance is reported by OpenArt when available."}</p><p class="cw-muted">A quote does not generate. Review the exact settings and credit estimate before starting a paid job.</p><p class="cw-notice">Results stay unreviewed. This workspace never publishes to a provider.</p></aside></div><div id="creativeCreations" class="cw-panel" hidden></div>`;
  document.getElementById("creativeModel").onchange = e => creativeAction(null, ctx => creativeLoadForm(e.target.value, ctx));
  for (const id of ["creativeActor", "creativeProject"]) document.getElementById(id).onchange = creativeClearQuote;
  document.getElementById("creativeBrowse").onclick = e => creativeAction(e.target, ctx => creativeBrowse(ctx));
  const more = document.getElementById("creativeProjectMore"); if (more) more.onclick = () => creativeAction(more, async ctx => { const r = CreativeMedia.unpack((await creativeInvoke("openart-library", { action: "projects", cursor: creativeState.projectCursor }, ctx)).result); creativeState.projects.push(...(r.items || [])); creativeState.projectCursor = r.nextCursor; creativeComposer(catalog); });
}
function creativeClearQuote() { creativeState.revision++; creativeState.quote = null; const el = document.getElementById("creativeQuote"); if (el) el.replaceChildren(); }
async function creativeLoadForm(index, ctx) {
  creativeClearQuote(); const formRequest = ++creativeState.formRequest; creativeState.form = null; creativeState.selectedMode = null;
  const target = document.getElementById("creativeModelFields"); target.textContent = "Loading model settings…";
  const choice = index === "" ? null : creativeState.modes[Number(index)]; if (!choice) { target.textContent = "Choose a model."; return; }
  const result = await creativeInvoke("openart-library", { action: "form", model: choice.model, mode: choice.mode }, ctx);
  if (creativeState.formRequest !== formRequest || document.getElementById("creativeModel").value !== index) return;
  const form = CreativeMedia.unpack(result.result); if (form.media !== choice.media || !form.jsonSchema?.properties) throw new Error("This model's form is unsupported. No generation was started.");
  creativeState.form = form; creativeState.selectedMode = choice;
  target.innerHTML = `<p class="cw-muted">${esc(choice.description || "")}</p><form id="creativeGeneration">${Object.entries(form.jsonSchema.properties).map(([key, field],i) => {
    const required = form.jsonSchema.required?.includes(key) ? "required" : "", label = esc(field.title || key.replaceAll("_", " ")), value = field.default;
    let input;
    if (Array.isArray(field.enum)) input = `<select data-field="${i}">${required ? "" : '<option value="">Default</option>'}${field.enum.map((v,j) => `<option value="${j}" ${v === value ? "selected" : ""}>${esc(String(v))}</option>`).join("")}</select>`;
    else if (field.type === "boolean") input = `<input type="checkbox" data-field="${i}" ${value === true ? "checked" : ""}>`;
    else if (["number","integer"].includes(field.type)) input = `<input type="number" data-field="${i}" ${required} step="${field.type === "integer" ? "1" : "any"}" ${Number.isFinite(field.minimum) ? `min="${field.minimum}"` : ""} ${Number.isFinite(field.maximum) ? `max="${field.maximum}"` : ""} value="${Number.isFinite(value) ? value : ""}">`;
    else input = `<textarea data-field="${i}" ${required} maxlength="10000" placeholder="${field.type === "array" || field.type === "object" ? "Structured references: use the format described below" : ""}">${esc(value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value))}</textarea>`;
    return `<label>${label}${required ? " *" : ""}${input}</label>${field.description ? `<p class="cw-muted">${esc(field.description)}</p>` : ""}${["array","object"].includes(field.type) ? `<details><summary>Reference format</summary><pre>${esc(JSON.stringify(field,null,2))}</pre></details>` : ""}`;
  }).join("")}<label class="cw-check"><input id="creativeConsent" type="checkbox" required>I approve sending these settings and selected references to OpenArt for a quote.</label><div class="cw-actions"><button class="cw-primary" type="submit">Review credit estimate</button></div></form>`;
  document.getElementById("creativeGeneration").oninput = creativeClearQuote;
  document.getElementById("creativeGeneration").onsubmit = e => { e.preventDefault(); creativeAction(e.submitter, ctx => creativeQuote(ctx)); };
}
async function creativeQuote(ctx) {
  const choice = creativeState.selectedMode, schema = creativeState.form?.jsonSchema;
  const project = creativeState.projects[Number(document.getElementById("creativeProject").value)];
  if (!choice || !schema || !project?.canGenerate) throw new Error("Choose a model and a project that allows generation.");
  const personaId = document.getElementById("creativeActor").value;
  if (!personaId || !myPersonas.some(p => p.id === personaId && p.owner === ctx.owner)) throw new Error("Choose an owned persona.");
  const params = Object.create(null);
  Object.entries(schema.properties).forEach(([key, field],i) => { const el = document.querySelector(`[data-field="${i}"]`); if (field.type === "boolean") { params[key] = el.checked; return; } if (el.value === "") return;
    if (field.enum) params[key] = field.enum[Number(el.value)];
    else if (["number","integer"].includes(field.type)) params[key] = Number(el.value);
    else if (["array","object"].includes(field.type)) { try { params[key] = JSON.parse(el.value); } catch { throw new Error(`Check the reference format for ${field.title || key}.`); } }
    else params[key] = el.value;
  });
  const request = { action: "quote", model: choice.model, mode: choice.mode, media: choice.media, projectId: project.id, personaId: personaId || null, params, consent: document.getElementById("creativeConsent").checked };
  const snapshot = JSON.stringify(request); creativeClearQuote(); const revision = creativeState.revision;
  const result = await creativeInvoke("openart-jobs", request, ctx);
  if (revision !== creativeState.revision) { creativeStatus("Settings changed while the estimate loaded. Request a fresh quote."); return; }
  // Lock to the exact server-recorded quote; any subsequent form edit removes approval.
  if (!CreativeMedia.uuid(result.job?.id) || !Number.isFinite(Number(result.job.quoted_credits))) throw new Error("The quote was incomplete. No generation was started.");
  creativeState.quote = { id: result.job.id, credits: Number(result.job.quoted_credits), snapshot, expires: result.job.quote_expires_at };
  document.getElementById("creativeQuote").innerHTML = `<div class="cw-notice"><h3>${esc(result.job.quoted_credits)} credits</h3><p>${esc(result.note || "Estimated credits")}</p><p>${esc(choice.label)} · ${esc(choice.mode)} · ${esc(project.name)}</p><details open><summary>Exact settings to send</summary><pre>${esc(JSON.stringify(params,null,2))}</pre></details><p class="cw-muted">Quote expires ${esc(result.job.quote_expires_at || "according to the provider")}. A result is not publication approval.</p><button class="cw-primary" id="creativeGenerate">Approve ${esc(result.job.quoted_credits)} credits &amp; generate</button></div>`;
  document.getElementById("creativeGenerate").onclick = e => creativeAction(e.target, async ctx => {
    const quote = creativeState.quote; if (!quote || (quote.expires && Date.parse(quote.expires) <= Date.now())) throw new Error("The quote expired or settings changed. Request a new estimate.");
    creativeClearQuote();
    try { const r = await creativeInvoke("openart-jobs", { action: "generate", id: quote.id, credits: quote.credits, approve: true }, ctx); creativeStatus(r.job?.status === "uncertain" ? "The provider receipt was interrupted. Check OpenArt before starting another generation; this request will not be resubmitted." : "Generation submitted. Refresh its status below to retrieve the result."); }
    catch (e) { creativeStatus("Generation receipt unavailable. Check history and OpenArt before creating another job; credits may have been spent."); }
    creativeState.jobs = (await creativeInvoke("openart-jobs", { action: "list" }, ctx)).jobs || []; creativeJobs();
  });
}
function creativeJobs() {
  document.getElementById("creativeJobs").innerHTML = creativeState.jobs.length ? creativeState.jobs.map((job,i) => `<article class="cw-job"><b>${esc(job.request?.model || "OpenArt")} · ${esc(job.status)}</b><p class="cw-muted">${esc(job.created_at)} · ${esc(job.quoted_credits)} quoted credits</p>${job.status === "uncertain" ? '<p class="cw-notice">Receipt uncertain. Check OpenArt before starting another generation.</p>' : ""}<div class="cw-actions">${["submitted", "dispatching"].includes(job.status) ? `<button data-refresh-job="${i}">Refresh status</button>` : ""}${job.status === "quoted" ? `<button data-cancel-quote="${i}">Discard unused quote</button>` : ""}${(job.result?.resources || []).filter(r => CreativeMedia.providerUrl(r.url) && !job.result.hideMedia).map((r,j) => `<button data-save-job="${i}" data-resource="${j}">Save ${esc(r.mediaType || "result")} reference</button>`).join("")}</div></article>`).join("") : '<p class="cw-muted">No generations yet. Start with a model and an estimate above.</p>';
  document.querySelectorAll("[data-refresh-job],[data-cancel-quote]").forEach(b => b.onclick = () => creativeAction(b, async ctx => { const index = Number(b.dataset.refreshJob ?? b.dataset.cancelQuote), job = creativeState.jobs[index]; await creativeInvoke("openart-jobs", { action: b.dataset.refreshJob != null ? "refresh" : "cancel", id: job.id }, ctx); creativeState.jobs = (await creativeInvoke("openart-jobs", { action: "list" }, ctx)).jobs || []; creativeJobs(); }));
  document.querySelectorAll("[data-save-job]").forEach(b => b.onclick = () => creativeAction(b, ctx => { const job = creativeState.jobs[Number(b.dataset.saveJob)], r = (job.result.resources || []).filter(r => CreativeMedia.providerUrl(r.url) && !job.result.hideMedia)[Number(b.dataset.resource)]; return creativeSaveReference({ ...r, title: job.request?.params?.prompt || "OpenArt result", persona_id: job.persona_id, project: job.request?.projectId }, ctx); }));
}
async function creativeBrowse(ctx, cursor) {
  const project = creativeState.projects[Number(document.getElementById("creativeProject").value)]; if (!project) throw new Error("Choose a project.");
  const data = CreativeMedia.unpack((await creativeInvoke("openart-library", { action: "creations", projectId: project.id, ...(cursor ? { cursor } : {}) }, ctx)).result);
  creativeState.creations = data.hideMedia ? [] : (data.items || []).filter(x => CreativeMedia.providerUrl(x.url));
  const el = document.getElementById("creativeCreations"); el.hidden = false;
  el.innerHTML = `<h3>${esc(project.name)} · creations</h3><p class="cw-muted">References stay on OpenArt until you explicitly download and import a copy.</p>${creativeState.creations.map((r,i) => `<div class="cw-job"><b>${esc(r.label || r.prompt || r.modelDisplayName || "OpenArt creation")}</b><p>${esc(r.mediaType)} · ${esc(r.status)}</p><button data-creation="${i}">Save reference to library</button></div>`).join("") || '<p>No visible results on this page.</p>'}${data.nextCursor ? '<button id="creativeCreationNext">Next page</button>' : ""}`;
  el.querySelectorAll("[data-creation]").forEach(b => b.onclick = () => creativeAction(b, ctx => { const r = creativeState.creations[Number(b.dataset.creation)]; return creativeSaveReference({ ...r, title: r.label || r.prompt || "OpenArt creation", project: project.name, persona_id: document.getElementById("creativeActor").value }, ctx); }));
  if (data.nextCursor) document.getElementById("creativeCreationNext").onclick = e => creativeAction(e.target, ctx => creativeBrowse(ctx, data.nextCursor));
}
async function creativeSaveReference(resource, ctx) {
  const source_url = CreativeMedia.providerUrl(resource.url); if (!source_url || !["image","video","audio"].includes(resource.mediaType)) throw new Error("This resource cannot be saved as a media reference.");
  if (!confirm("Save this OpenArt reference in your private library? Confirm you have permission to retain this media and any depicted likeness. The file stays hosted by OpenArt; no training or publishing permission is granted.")) return;
  const meta = CreativeMedia.metadata({ title: String(resource.title || "OpenArt result").slice(0,200), source_tool: "openart", persona_id: resource.persona_id || null, project: resource.project || "", rights_confirmed: true }, ctx.owner, myPersonas);
  const r = await sb.from("owner_media_library").insert({ ...meta, kind: resource.mediaType, source_url }); creativeAssert(ctx);
  if (r.error) throw new Error("Reference could not be saved. The private library migration must be available."); creativeStatus("Saved an unreviewed OpenArt reference. Open Library to describe it or import a downloaded copy.");
}

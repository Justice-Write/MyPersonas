import { createHash } from 'node:crypto';

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const sha256 = value => createHash('sha256').update(canonical(value)).digest('hex');
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const sections = ['profile','destination_links','account_bindings','media_assets','layout','posts','albums','family','dependencies','businesses','revenue','request_review','automation_safety'];
const arrays = ['destination_links','account_bindings','media_assets','posts','albums','family','dependencies','businesses'];
const privateKeys = /^(owner|owner_id|owner_notes|login_email|provider_email|generation_prompt|context_log|purpose|voice|audience|dont|api_key|access_token|refresh_token|password|secret|service_role_key)$/i;
function rejectPrivateFields(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (privateKeys.test(key)) throw new Error(`Private field is outside the review snapshot contract: ${key}`);
    rejectPrivateFields(item);
  }
}

export function buildReviewBatch(snapshot, expectedHandles = []) {
  if (snapshot?.schema_version !== 1 || !Number.isFinite(Date.parse(snapshot.captured_at)) ||
      snapshot.source !== 'authenticated_read_only_database' || !Array.isArray(snapshot.personas)) throw new Error('Invalid snapshot envelope');
  const handles = new Set();
  const packets = snapshot.personas.map(input => {
    const handle = input.profile?.handle;
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(handle || '') || handles.has(handle.toLowerCase())) throw new Error('Invalid or duplicate persona handle');
    handles.add(handle.toLowerCase());
    if (!Number.isInteger(input.profile.publication_revision) || input.profile.publication_revision < 1 || input.profile.visibility !== 'public') throw new Error(`Invalid revision/visibility: ${handle}`);
    const surface = {};
    for (const key of sections) {
      if (!Object.hasOwn(input, key) || !input[key] || typeof input[key] !== 'object') throw new Error(`Missing surface: ${handle}/${key}`);
      if (arrays.includes(key) && !Array.isArray(input[key])) throw new Error(`Invalid surface: ${key}`);
      surface[key] = input[key];
    }
    rejectPrivateFields(surface);
    const unknowns = [
      {code:'owner_field_decisions', action:'Review preserve/change/hide/clear/reject for every exact public field and child surface.'},
      {code:'rights_and_likeness', action:'Supply rights and likeness consent evidence for each media asset.'},
      {code:'account_authority', action:'Verify exact destination accounts, roles, recovery, MFA, scopes and expiry with the owner.'},
      {code:'site_associations', action:'Confirm canonical website/business associations; an existing URL is not approval.'},
      {code:'provider_and_policy', action:'Review provider/category policy and any regulated-content gates for this exact persona.'},
      {code:'action_time_review', action:'Refresh the snapshot, review its exact hash under AAL2, then obtain separate publication authorization.'}
    ];
    const findings = [];
    if (!surface.profile.ai_disclosure?.trim()) findings.push('missing_ai_disclosure');
    if (surface.family.some(x=>x.canon_status !== 'owner_confirmed')) findings.push('unresolved_family_canon');
    if (surface.dependencies.some(x=>x.publication_state !== 'published' || x.publication_revision !== x.dependency_revision)) findings.push('dependency_not_currently_published');
    if (surface.media_assets.some(x=>!x.alt_text?.trim())) findings.push('media_alt_text_missing');
    if (surface.media_assets.some(x=>!x.content_sha256 || !x.provenance_sha256)) findings.push('media_integrity_unverified');
    if (surface.media_assets.some(x=>x.ai_use !== 'none' && x.watermark_state !== 'system_applied')) findings.push('ai_media_watermark_needs_review');
    const urls = [surface.profile.avatar_url,surface.profile.banner_url,surface.profile.bg_url,surface.profile.feed_img_url,
      ...surface.media_assets.map(x=>x.public_url),...surface.posts.map(x=>x.media_url),...surface.albums.flatMap(x=>(x.items || []).map(y=>y.thumb_url))].filter(Boolean);
    if (urls.some(x=>/\/storage\/v1\/object\//.test(x) && /[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(x))) findings.push('public_media_owner_correlation_requires_opaque_delivery');
    const packet = {
      schema_version:1, captured_at:snapshot.captured_at, source:snapshot.source,
      handle, revision:surface.profile.publication_revision, surface,
      surface_sha256:sha256(surface), section_sha256:Object.fromEntries(sections.map(k=>[k,sha256(surface[k])])),
      readiness:'owner_review_required', findings, unknowns,
      decisions:Object.fromEntries(sections.map(k=>[k,'pending'])),
      approval_receipt:null, publish_authorized:false
    };
    return {...packet,packet_sha256:sha256(packet)};
  }).sort((a,b)=>a.handle.localeCompare(b.handle));
  const missing = expectedHandles.filter(x=>!handles.has(x.toLowerCase()));
  const unexpected = expectedHandles.length ? packets.filter(x=>!expectedHandles.includes(x.handle)).map(x=>x.handle) : [];
  return {schema_version:1,captured_at:snapshot.captured_at,source_snapshot_sha256:sha256(snapshot),
    read_only:true,publish_authorized:false,coverage:{expected:expectedHandles.length,actual:packets.length,missing,unexpected},packets};
}

export function reviewHtml(batch) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Private persona review</title><style>body{font:16px system-ui;max-width:1050px;margin:2rem auto;padding:0 1rem;color:#202c3c}h1,h2{color:#413687}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f4f8;padding:1rem}details{margin:1rem 0}a{color:#413687}small{overflow-wrap:anywhere}</style><h1>Private persona review</h1><p>Captured ${escapeHtml(batch.captured_at)}. ${batch.packets.length} personas. Read-only preparation; no publication is authorized. Media is described, never loaded. Account records do not prove provider authorization.</p><p>Snapshot SHA-256: <small>${batch.source_snapshot_sha256}</small></p><nav>${batch.packets.map(p=>`<a href="#${escapeHtml(p.handle)}">${escapeHtml(p.handle)}</a>`).join(' · ')}</nav>${batch.packets.map(p=>`<section id="${escapeHtml(p.handle)}"><h2>${escapeHtml(p.surface.profile.name)} · @${escapeHtml(p.handle)}</h2><p>Revision ${p.revision}; ${escapeHtml(p.surface.profile.publication_state)}; owner review required.</p><small>Packet ${p.packet_sha256}</small><p>Findings: ${escapeHtml(p.findings.join(', ') || 'No automated finding; owner checks still required.')}</p><ul>${p.unknowns.map(u=>`<li>${escapeHtml(u.action)}</li>`).join('')}</ul>${sections.map(k=>`<details><summary>${escapeHtml(k)} · decision pending</summary><pre>${escapeHtml(JSON.stringify(p.surface[k],null,2))}</pre></details>`).join('')}</section>`).join('')}</html>`;
}

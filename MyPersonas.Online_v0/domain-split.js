// Domain split (owner ruling 2026-10-31):
//   aliaspaces.com     — the AliaSpaces social site (persona pages, feeds, persona view).
//   mypersonas.online  — reserved for managing the AI-assisted persona platform
//                        (owner workspace, creative tools, automation, providers).
// Both domains serve this same build. This file decides which domain a view
// belongs to. It loads before the app, has no dependencies, and never redirects
// on any other host (localhost, previews, tests keep every view).
(() => {
  "use strict";

  const SOCIAL_ORIGIN = "https://aliaspaces.com";
  const CONTROL_ORIGIN = "https://mypersonas.online";
  const SOCIAL_HOSTS = Object.freeze(["aliaspaces.com", "www.aliaspaces.com"]);
  const CONTROL_HOSTS = Object.freeze(["mypersonas.online", "www.mypersonas.online"]);
  // The owner workspace. Mirrors PERSONA_VIEW_OWNER_ROUTES in persona-view.js;
  // tests/domain-split.test.mjs keeps the two lists identical. The Overview
  // owner home ("owner" outside Persona view) is also management.
  const CONTROL_VIEWS = Object.freeze([
    "create", "library", "studio", "edit", "review", "persona-settings", "business-settings",
    "agent-board", "platform-queue", "briefs", "schedule", "fan-inbox",
    "activity", "notifications", "discovery", "onboard", "owner-preview",
  ]);
  // Public social surfaces. They always render on aliaspaces.com.
  const SOCIAL_VIEWS = Object.freeze(["p", "b", "tag", "search", "friend-invite"]);
  // Added to every cross-domain hop. A page that arrives with it never bounces
  // straight back, so a stale deployment on either side cannot cause a loop.
  const HOP_PARAM = "hop";

  const controlViews = new Set(CONTROL_VIEWS);
  const socialViews = new Set(SOCIAL_VIEWS);

  function roleFor(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (SOCIAL_HOSTS.includes(host)) return "social";
    if (CONTROL_HOSTS.includes(host)) return "control";
    return "local";
  }

  function identityFor(role) {
    const social = role === "social";
    return {
      name: social ? "AliaSpaces" : "MyPersonas",
      title: social ? "AliaSpaces — every persona, one home" : "MyPersonas — your private creative workspace",
      description: social ? "Discover persona pages, feeds, friends and creative communities on AliaSpaces." : "Manage personas, creative media, automation and private drafts. Review exact previews before approval.",
      origin: social ? SOCIAL_ORIGIN : CONTROL_ORIGIN,
    };
  }

  function applyIdentity(doc, role) {
    if (!doc || role === "local") return;
    const identity = identityFor(role);
    doc.title = identity.title;
    const set = (selector, attribute, value) => doc.querySelector(selector)?.setAttribute(attribute, value);
    set('link[rel="canonical"]', "href", `${identity.origin}/`);
    for (const [selector, value] of [
      ['meta[name="description"]', identity.description],
      ['meta[property="og:site_name"]', identity.name],
      ['meta[property="og:title"]', identity.title],
      ['meta[property="og:description"]', identity.description],
      ['meta[property="og:url"]', `${identity.origin}/`],
      ['meta[property="og:image"]', `${identity.origin}/assets/hero.png`],
      ['meta[name="twitter:title"]', identity.title],
      ['meta[name="twitter:description"]', identity.description],
      ['meta[name="twitter:image"]', `${identity.origin}/assets/hero.png`],
      ['meta[name="apple-mobile-web-app-title"]', identity.name],
    ]) set(selector, "content", value);
    const schema = doc.querySelector('script[type="application/ld+json"]');
    if (schema) schema.textContent = JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:identity.name,url:`${identity.origin}/`,description:identity.description});
  }

  function pathFromHash(hash) {
    return String(hash || "").replace(/^#\/?/, "");
  }

  function viewFromPath(path) {
    return String(path || "").split("/")[0];
  }

  function hopUrl(origin, path) {
    return `${origin}/?${HOP_PARAM}=1#/${path}`;
  }

  // Which domain owns this view. "both" means it renders wherever it is opened.
  function owner(view, state = {}) {
    if (controlViews.has(view)) return "control";
    if (socialViews.has(view)) return "social";
    // Both hosts need an owner entry: on social it selects an exact actor when
    // none is active. Overview navigation explicitly opens management.
    return "both";
  }

  // Pure decision: the URL to leave for, or null to stay.
  function destination({ role, hash, ready = false, mode = "overview" }) {
    if (role !== "social" && role !== "control") return null;
    const path = pathFromHash(hash);
    const side = owner(viewFromPath(path), { ready, mode });
    if (role === "social" && side === "control") return hopUrl(CONTROL_ORIGIN, path);
    if (role === "control" && side === "social") return hopUrl(SOCIAL_ORIGIN, path);
    return null;
  }

  function cleanPublicPath(path) {
    return String(path || "").replace(/^#?\/?/, "");
  }

  // Share links always point at the social site, except on local hosts.
  function publicUrlFor(path, loc) {
    const clean = cleanPublicPath(path);
    if (roleFor(loc && loc.hostname) === "local") {
      return `${loc.origin}${String(loc.pathname || "/").replace(/index\.html$/, "")}#/${clean}`;
    }
    return `${SOCIAL_ORIGIN}/#/${clean}`;
  }

  function managementUrlFor(path, loc) {
    const clean = cleanPublicPath(path);
    if (roleFor(loc && loc.hostname) === "local") {
      return `${loc.origin}${String(loc.pathname || "/").replace(/index\.html$/, "")}#/${clean}`;
    }
    return hopUrl(CONTROL_ORIGIN, clean);
  }

  const api = {
    SOCIAL_ORIGIN, CONTROL_ORIGIN, SOCIAL_HOSTS, CONTROL_HOSTS, CONTROL_VIEWS, SOCIAL_VIEWS, HOP_PARAM,
    roleFor, identityFor, applyIdentity, owner, destination, publicUrlFor, managementUrlFor,
  };

  const root = typeof globalThis !== "undefined" ? globalThis : undefined;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  const loc = root && root.location;
  if (!loc || typeof loc.hostname !== "string") { if (root) root.MyPersonasDomains = api; return; }

  const role = roleFor(loc.hostname);
  // Non-secret navigation intent only. Keep it in this tab across sign-in/MFA,
  // never in a URL query sent to a server, and consume it only after roster load.
  const intentKey = "aliaspaces_pending_persona_v1";
  let pendingIntent = null;
  if (role === "social" && /^#\/owner\//.test(loc.hash)) {
    pendingIntent = { id: String(loc.hash).slice("#/owner/".length), at: Date.now() };
    try { root.sessionStorage.setItem(intentKey, JSON.stringify(pendingIntent)); } catch (_) {}
    if (root.history?.replaceState) root.history.replaceState(root.history.state, "", loc.pathname + loc.search + "#/owner");
  }
  function takePersonaIntent() {
    if (role !== "social") return null;
    let intent = pendingIntent;
    pendingIntent = null;
    try {
      const saved = root.sessionStorage.getItem(intentKey);
      root.sessionStorage.removeItem(intentKey);
      if (!intent && saved) {
        try { intent = JSON.parse(saved) || {}; } catch (_) { intent = {}; }
      }
    } catch (_) {}
    if (!intent) return null;
    const valid = typeof intent.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intent.id)
      && Number.isFinite(intent.at) && Date.now() >= intent.at && Date.now() - intent.at <= 15 * 60 * 1000;
    return { id: valid ? intent.id : "" }; // Invalid intent suppresses saved-actor fallback too.
  }
  applyIdentity(root.document, role);
  let arrivedByHop = false;
  try {
    const url = new URL(loc.href);
    if (url.searchParams.get(HOP_PARAM) === "1") {
      arrivedByHop = true;
      url.searchParams.delete(HOP_PARAM);
      if (root.history && typeof root.history.replaceState === "function") {
        root.history.replaceState(root.history.state, "", url.pathname + url.search + url.hash);
      }
    }
  } catch (_) {}
  // The other domain just sent us here for this exact view, so never send it
  // straight back. Once the visitor moves to another view, normal rules apply.
  const arrivalHash = arrivedByHop ? String(loc.hash || "") : null;

  function leaveFor(state = {}) {
    // Finish same-origin authentication before considering a cross-domain route.
    // Never forward callback queries or tokens to the other host.
    try {
      const url = new URL(loc.href);
      if (url.searchParams.has("code") || url.searchParams.has("error") || /(?:^#|[&])(?:access_token|refresh_token|error)=/.test(url.hash)) return null;
    } catch (_) {}
    if (arrivalHash !== null && String(loc.hash || "") === arrivalHash) return null;
    return destination({ role, hash: loc.hash, ready: !!state.ready, mode: state.mode });
  }

  function leave(state) {
    const url = leaveFor(state);
    if (!url) return false;
    loc.replace(url);
    return true;
  }

  // In-app navigation to another domain's view opens that domain instead of
  // changing the hash. Returns true when it navigated away.
  function goAcross(path, state = {}) {
    const url = destination({ role, hash: `#/${cleanPublicPath(path)}`, ready: !!state.ready, mode: state.mode });
    if (!url) return false;
    loc.assign(url);
    return true;
  }

  root.MyPersonasDomains = Object.freeze({
    ...api,
    role: () => role,
    takePersonaIntent,
    leave,
    leaveFor,
    goAcross,
    publicUrl: (path) => publicUrlFor(path, loc),
    managementUrl: (path) => managementUrlFor(path, loc),
    socialHome: () => (role === "local" ? null : `${SOCIAL_ORIGIN}/`),
  });

  // Views that never depend on the session leave before the app boots.
  leave({ ready: false });
})();

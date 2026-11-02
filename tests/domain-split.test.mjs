import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = (name) => path.join(repoRoot, "MyPersonas.Online_v0", name);
const domains = await (async () => {
  // No location: the file only exports its pure rules.
  const sandbox = { module: { exports: {} }, URL };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(await readFile(site("domain-split.js"), "utf8"), sandbox);
  return sandbox.module.exports;
})();

async function boot(href) {
  const url = new URL(href);
  const calls = { replace: [], assign: [], replaceState: [] };
  const location = {
    get href() { return url.href; }, get hostname() { return url.hostname; }, get origin() { return url.origin; },
    get pathname() { return url.pathname; }, get search() { return url.search; },
    get hash() { return url.hash; }, set hash(value) { url.hash = value; },
    replace(next) { calls.replace.push(next); }, assign(next) { calls.assign.push(next); },
  };
  const history = { state: null, replaceState(_state, _title, next) { calls.replaceState.push(next); const n = new URL(next, url); url.search = n.search; url.hash = n.hash; } };
  const sandbox = { location, history, URL };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(await readFile(site("domain-split.js"), "utf8"), sandbox);
  return { api: sandbox.MyPersonasDomains, calls, url };
}

test("hosts map to roles; every other host keeps all views", () => {
  assert.equal(domains.roleFor("aliaspaces.com"), "social");
  assert.equal(domains.roleFor("WWW.AliaSpaces.com"), "social");
  assert.equal(domains.roleFor("mypersonas.online"), "control");
  assert.equal(domains.roleFor("www.mypersonas.online"), "control");
  for (const host of ["localhost", "127.0.0.1", "aliaspaces.com.evil.test", "evil-mypersonas.online", ""]) {
    assert.equal(domains.roleFor(host), "local", host);
  }
});

test("management views mirror the Persona view owner-route list", async () => {
  const source = await readFile(site("persona-view.js"), "utf8");
  const block = source.match(/const PERSONA_VIEW_OWNER_ROUTES = new Set\(\[([\s\S]*?)\]\);/)[1];
  const routes = [...block.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...domains.CONTROL_VIEWS].sort(), routes.sort());
  for (const view of domains.SOCIAL_VIEWS) assert.equal(domains.CONTROL_VIEWS.includes(view), false, view);
});

test("aliaspaces.com sends management views to mypersonas.online and keeps social views", () => {
  const d = (hash, extra = {}) => domains.destination({ role: "social", hash, ...extra });
  assert.equal(d("#/studio"), "https://mypersonas.online/?hop=1#/studio");
  assert.equal(d("#/briefs/abc"), "https://mypersonas.online/?hop=1#/briefs/abc");
  assert.equal(d("#/edit/new"), "https://mypersonas.online/?hop=1#/edit/new");
  for (const hash of ["", "#/", "#/p/avi", "#/b/acme", "#/tag/food", "#/search/avi", "#/friend-invite/1", "#/signin"]) {
    assert.equal(d(hash), null, hash);
  }
  assert.equal(d("#/owner"), null, "owner waits for the session");
  assert.equal(d("#/owner", { ready: true, mode: "persona" }), null, "Persona view is the social home");
  assert.equal(d("#/owner", { ready: true, mode: "overview" }), "https://mypersonas.online/?hop=1#/owner");
});

test("mypersonas.online sends public social views to aliaspaces.com and keeps management", () => {
  const d = (hash, extra = {}) => domains.destination({ role: "control", hash, ...extra });
  assert.equal(d("#/p/avi"), "https://aliaspaces.com/?hop=1#/p/avi");
  assert.equal(d("#/search/a%20b"), "https://aliaspaces.com/?hop=1#/search/a%20b");
  assert.equal(d("#/friend-invite/9"), "https://aliaspaces.com/?hop=1#/friend-invite/9");
  for (const hash of ["", "#/owner", "#/studio", "#/create", "#/library", "#/signin"]) assert.equal(d(hash), null, hash);
  assert.equal(d("#/owner", { ready: true, mode: "overview" }), null);
});

test("local hosts never redirect", () => {
  for (const hash of ["#/studio", "#/p/avi", "#/owner"]) {
    assert.equal(domains.destination({ role: "local", hash, ready: true, mode: "overview" }), null);
  }
});

test("Supabase and provider callbacks are never redirected", () => {
  for (const role of ["social", "control"]) {
    for (const hash of ["#access_token=x&refresh_token=y&type=magiclink", "#error=access_denied", ""]) {
      assert.equal(domains.destination({ role, hash, ready: true, mode: "overview" }), null, `${role} ${hash}`);
    }
  }
});

test("share links point at aliaspaces.com except on local hosts", () => {
  const loc = (href) => { const u = new URL(href); return { hostname: u.hostname, origin: u.origin, pathname: u.pathname }; };
  assert.equal(domains.publicUrlFor("p/avi", loc("https://mypersonas.online/")), "https://aliaspaces.com/#/p/avi");
  assert.equal(domains.publicUrlFor("#/p/avi", loc("https://aliaspaces.com/")), "https://aliaspaces.com/#/p/avi");
  assert.equal(domains.publicUrlFor("p/avi", loc("http://localhost:8080/MyPersonas.Online_v0/index.html")), "http://localhost:8080/MyPersonas.Online_v0/#/p/avi");
  assert.equal(domains.managementUrlFor("owner", loc("https://aliaspaces.com/")), "https://mypersonas.online/?hop=1#/owner");
});

test("a page leaves before the app boots when its view belongs to the other domain", async () => {
  const control = await boot("https://mypersonas.online/#/p/avi");
  assert.deepEqual(control.calls.replace, ["https://aliaspaces.com/?hop=1#/p/avi"]);
  const social = await boot("https://aliaspaces.com/#/studio");
  assert.deepEqual(social.calls.replace, ["https://mypersonas.online/?hop=1#/studio"]);
  const stay = await boot("https://aliaspaces.com/#/p/avi");
  assert.deepEqual(stay.calls.replace, []);
  const owner = await boot("https://aliaspaces.com/#/owner");
  assert.deepEqual(owner.calls.replace, [], "owner depends on the signed-in mode");
  assert.equal(owner.api.leave({ ready: true, mode: "persona" }), false);
  assert.equal(owner.api.leave({ ready: true, mode: "overview" }), true);
  assert.deepEqual(owner.calls.replace, ["https://mypersonas.online/?hop=1#/owner"]);
});

test("a hop never bounces straight back, so a stale deployment cannot loop", async () => {
  const page = await boot("https://mypersonas.online/?hop=1#/p/avi");
  assert.deepEqual(page.calls.replace, [], "arrival view stays");
  assert.deepEqual(page.calls.replaceState, ["/#/p/avi"], "hop marker is removed from the address bar");
  assert.equal(page.api.leave({ ready: true, mode: "overview" }), false, "still the arrival view");
  page.url.hash = "#/tag/food";
  assert.equal(page.api.leave({ ready: true, mode: "overview" }), true, "a new view follows the normal rule");
  assert.deepEqual(page.calls.replace, ["https://aliaspaces.com/?hop=1#/tag/food"]);
});

test("in-app navigation crosses domains only for the other domain's views", async () => {
  const social = await boot("https://aliaspaces.com/");
  assert.equal(social.api.goAcross("p/avi"), false);
  assert.equal(social.api.goAcross("owner", { ready: true, mode: "persona" }), false);
  assert.equal(social.api.goAcross("create"), true);
  assert.deepEqual(social.calls.assign, ["https://mypersonas.online/?hop=1#/create"]);
  assert.equal(social.api.socialHome(), "https://aliaspaces.com/");
  const local = await boot("http://localhost:4173/");
  assert.equal(local.api.goAcross("create"), false);
  assert.equal(local.api.socialHome(), null);
});

test("the app wires the split into loading, routing, modes and share links", async () => {
  const [html, ownerApp, governance, workflow] = await Promise.all([
    readFile(site("index.html"), "utf8"),
    readFile(site("owner-app.js"), "utf8"),
    readFile(site("platform-governance.js"), "utf8"),
    readFile(path.join(repoRoot, ".github/workflows/pages.yml"), "utf8"),
  ]);
  const splitTag = html.indexOf('<script src="./domain-split.js?v=');
  assert.ok(splitTag > 0 && splitTag < html.indexOf('<script src="./pwa.js?v=20261102-2" defer>'), "loads first, without defer");
  assert.doesNotMatch(html, /domain-split\.js\?v=[^"]*" (?:defer|async)/);
  assert.ok(workflow.includes("--include '/domain-split.js'"), "published by Pages");
  const route = html.slice(html.indexOf("async function route(){"), html.indexOf("// ---------- sign in ----------"));
  assert.ok(route.indexOf("MyPersonasDomains.leave(domainState())") < route.indexOf("renderSidebar()"), "leaves before rendering");
  assert.match(route, /siteRole==="control"&&session&&!view\)\{history\.replaceState\(history\.state,"","#\/owner"\)/);
  assert.match(route, /!session&&!view&&siteRole!=="social"\)return renderCreativeLanding\(\)/);
  assert.match(html, /function go\(h\)\{[^\n]*MyPersonasDomains\.goAcross\(h,domainState\(\)\)/);
  assert.match(html, /function sharePage\(handle\)\{copyText\(publicPageUrl\(handle\)\)\}/);
  assert.match(html, /onclick="closeSiteMenu\(\);goDiscover\(\)">Discover \(Entangle\)/);
  assert.match(governance, /MyPersonasDomains\.publicUrl\(`friend-invite\/\$\{personaId\}`\)/);
  assert.match(ownerApp, /siteRole === "social" \? \(ownerAppSelectedPersonaStrict\(\) \? "persona" : "overview"\)/);
  assert.match(ownerApp, /siteRole === "control" && next === "persona"\) \{ location\.assign/);
  assert.match(ownerApp, /siteRole === "social" && next === "overview"\) \{ location\.assign\(domains\.managementUrl\("owner"\)\)/);
});

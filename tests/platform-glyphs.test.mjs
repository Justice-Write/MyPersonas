import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(root, "MyPersonas.Online_v0");
const iconDir = path.join(siteRoot, "src/assets/platform-icons");
const [html, personaView, ownerApp, ownerCss, workflow, worker, iconMap] = await Promise.all([
  readFile(path.join(siteRoot, "index.html"), "utf8"),
  readFile(path.join(siteRoot, "persona-view.js"), "utf8"),
  readFile(path.join(siteRoot, "owner-app.js"), "utf8"),
  readFile(path.join(siteRoot, "owner-app.css"), "utf8"),
  readFile(path.join(root, ".github/workflows/pages.yml"), "utf8"),
  readFile(path.join(siteRoot, "service-worker.js"), "utf8"),
  readFile(path.join(iconDir, "index.js"), "utf8"),
]);

function ledgerPlatformIds(source) {
  const start = source.indexOf("const PLATS={");
  const end = source.indexOf("const LEDGER_EMAIL_PROVIDERS", start);
  assert.ok(start >= 0 && end > start, "PLATS catalog was not found");
  const ids = [...source.slice(start, end).matchAll(/([A-Za-z][A-Za-z0-9]*):\{name:/g)].map((match) => match[1]);
  assert.ok(ids.length > 20, "PLATS catalog did not parse");
  return ids;
}

function spriteGlyphs(source) {
  const start = source.indexOf('<svg xmlns="http://www.w3.org/2000/svg" style="display:none"');
  const end = source.indexOf("</svg>", start);
  assert.ok(start >= 0 && end > start, "inline icon sprite was not found");
  return [...source.slice(start, end).matchAll(/<symbol id="i-plat-([a-z0-9]+)" viewBox="0 0 24 24">([\s\S]*?)<\/symbol>/g)]
    .map((match) => ({ id: match[1], body: match[2] }));
}

test("every named ledger platform has exactly one non-empty inline glyph", () => {
  const ids = ledgerPlatformIds(html);
  const glyphs = spriteGlyphs(html);
  const glyphIds = glyphs.map((glyph) => glyph.id);
  assert.deepEqual(glyphIds, [...new Set(glyphIds)], "a platform glyph id is duplicated");
  assert.deepEqual(ids.filter((id) => !glyphIds.includes(id)), [], "a ledger platform is missing a glyph");
  assert.deepEqual(glyphIds.filter((id) => !ids.includes(id)), [], "a glyph has no ledger platform");
  for (const glyph of glyphs) {
    assert.match(glyph.body, /<(?:path|circle|rect|ellipse|polygon|polyline|line)\b/, `${glyph.id} is empty`);
  }
});

test("the typed component map covers the catalog and renders only fixed sprite references", () => {
  const ids = ledgerPlatformIds(html).sort();
  assert.match(iconMap, /Readonly<Record<PlatformId, \(\) => string>>/);
  assert.deepEqual([...iconMap.matchAll(/"([a-z0-9]+)": \(\) => ico/g)].map((match) => match[1]).sort(), ids);
  assert.doesNotMatch(iconMap, /\b(?:fetch|XMLHttpRequest|eval|Function)\b/);

  const context = { ico: (name) => `<svg data-icon="${name}"></svg>` };
  vm.runInNewContext(iconMap, context, { filename: "platform-icons/index.js" });
  assert.equal(Object.isFrozen(context.PLATFORM_ICONS), true);
  for (const id of ids) {
    assert.equal(context.PLATFORM_ICONS[id](), `<svg data-icon="plat-${id}"></svg>`);
  }
});

test("standalone SVGs are inert, bounded, and exactly mirror the inline sprite", async () => {
  const ids = ledgerPlatformIds(html).sort();
  const files = (await readdir(iconDir)).filter((name) => name.endsWith(".svg")).sort();
  assert.deepEqual(files.map((name) => name.slice(0, -4)), ids);

  for (const { id, body } of spriteGlyphs(html)) {
    const svg = await readFile(path.join(iconDir, `${id}.svg`), "utf8");
    assert.ok(Buffer.byteLength(svg) <= 2048, `${id} exceeds the 2 KiB asset limit`);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"/);
    assert.match(svg, /stroke="currentColor"/);
    assert.doesNotMatch(svg, /<(?:script|foreignObject|iframe|image)\b|\son[a-z]+\s*=|(?:href|src)=/i);
    assert.ok(svg.includes(body), `${id} differs from the rendered sprite`);
  }
});

test("all current platform UI consumers use the bounded glyph helper", () => {
  assert.match(html, /function platformGlyph\(id\)/);
  assert.match(html, /return PLATFORM_ICONS\[key\]\(\)/);
  assert.match(html, /platformGlyph\(provider\)/);
  assert.match(html, /platformGlyph\(l\.platform\)/);
  assert.match(personaView, /platformGlyph\(link\.platform\)/);
  assert.match(ownerApp, /function ownerAppPortalIcon\(provider\)[\s\S]*?return platformGlyph\(provider\)/);
  assert.match(ownerCss, /\.oa-listicon \.ico\{width:20px;height:20px;margin:0\}/);
  assert.doesNotMatch(html, /\$\{ico\("node"\)\}\$\{esc\(l\.handle/);
  assert.doesNotMatch(html, /\$\{esc\(meta\.icon\|\|"🔗"\)\}/);
});

test("the exact glyph bank is packaged but not added to the private-workflow cache", () => {
  const script = '<script src="./src/assets/platform-icons/index.js?v=20261030-1"></script>';
  assert.ok(html.includes(script));
  assert.ok(html.indexOf(script) < html.indexOf("const PLATS={"), "glyph map must load before the main app script");
  for (const releasePath of [
    "/src/",
    "/src/assets/",
    "/src/assets/platform-icons/",
    "/src/assets/platform-icons/***",
  ]) {
    assert.ok(workflow.includes(`--include '${releasePath}'`), `Pages artifact must include ${releasePath}`);
  }
  assert.doesNotMatch(worker, /platform-icons/, "platform glyphs must not widen the public-shell cache boundary");
});

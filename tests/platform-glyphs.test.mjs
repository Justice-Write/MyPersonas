import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(path.join(root, "MyPersonas.Online_v0/index.html"), "utf8");
const personaView = await readFile(path.join(root, "MyPersonas.Online_v0/persona-view.js"), "utf8");

function ledgerPlatformIds(source) {
  const start = source.indexOf("const PLATS={");
  const end = source.indexOf("const LEDGER_EMAIL_PROVIDERS", start);
  assert.ok(start >= 0 && end > start, "PLATS catalog was not found");
  const ids = [...source.slice(start, end).matchAll(/([A-Za-z][A-Za-z0-9]*):\{name:/g)].map((match) => match[1]);
  assert.ok(ids.length > 20, "PLATS catalog did not parse");
  return ids;
}

function hologramGlyphs(source) {
  const start = source.indexOf('<svg xmlns="http://www.w3.org/2000/svg" style="display:none"');
  const end = source.indexOf("</svg>", start);
  assert.ok(start >= 0 && end > start, "hologram icon bank was not found");
  return [...source.slice(start, end).matchAll(/<symbol id="i-plat-([a-z0-9]+)" viewBox="0 0 24 24">([\s\S]*?)<\/symbol>/g)]
    .map((match) => ({ id: match[1], body: match[2] }));
}

test("every ledger platform id the UI names has one hologram glyph", () => {
  const ids = ledgerPlatformIds(html);
  const glyphs = hologramGlyphs(html);
  const glyphIds = glyphs.map((glyph) => glyph.id);
  assert.deepEqual(glyphIds, [...new Set(glyphIds)], "a platform glyph id is duplicated");
  const missing = ids.filter((id) => !glyphIds.includes(id));
  const extra = glyphIds.filter((id) => !ids.includes(id));
  assert.deepEqual(missing, [], `platform ids with no glyph: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `glyphs without a ledger platform id: ${extra.join(", ")}`);
  for (const glyph of glyphs) {
    assert.match(
      glyph.body,
      /<(?:path|circle|rect|ellipse|polygon|polyline|line)\b/,
      `${glyph.id} has an empty hologram glyph`,
    );
  }
});

test("ledger rows and named platform links use the hologram glyph", () => {
  assert.match(html, /function platformGlyph\(id\)/);
  assert.match(html, /return PLATFORM_ICONS\[key\]\(\)/);
  assert.match(html, /platformGlyph\(provider\)/);
  assert.match(html, /platformGlyph\(l\.platform\)/);
  assert.match(personaView, /platformGlyph\(link\.platform\)/);
  assert.doesNotMatch(html, /meta\.icon/);
  assert.doesNotMatch(html, /\$\{ico\("node"\)\}\$\{esc\(l\.handle/);
});

test("standalone SVGs and typed component map match the ledger and sprite", async () => {
  const dir = path.join(root, "MyPersonas.Online_v0/src/assets/platform-icons");
  const ids = ledgerPlatformIds(html).sort();
  assert.deepEqual((await readdir(dir)).filter(name => name.endsWith(".svg")).map(name => name.slice(0, -4)).sort(), ids);
  const map = await readFile(path.join(dir, "index.js"), "utf8");
  assert.match(map, /Readonly<Record<PlatformId, \(\) => string>>/);
  assert.deepEqual([...map.matchAll(/"([a-z0-9]+)": \(\) => ico/g)].map(match => match[1]).sort(), ids);
  for (const {id, body} of hologramGlyphs(html)) {
    const svg = await readFile(path.join(dir, id + ".svg"), "utf8");
    assert.ok(Buffer.byteLength(svg) <= 2048, id);
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.match(svg, /stroke="currentColor"/);
    assert.doesNotMatch(svg, /(?:href|src)=/);
    assert.ok(svg.includes(body), id + " differs from the rendered sprite");
  }
});

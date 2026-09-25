import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [indexHtml, personaView] = await Promise.all([
  readFile(path.join(repoRoot, "MyPersonas.Online_v0/index.html"), "utf8"),
  readFile(path.join(repoRoot, "MyPersonas.Online_v0/persona-view.js"), "utf8"),
]);

test("public and persona-mode headers render the escaped profile title", () => {
  assert.match(indexHtml, /p\.title\?`<div class="pp-title">\$\{esc\(p\.title\)\}<\/div>`:""/);
  assert.match(personaView, /p\.title \? `<div class="pp-title">\$\{esc\(p\.title\)\}<\/div>` : ""/);
  assert.match(indexHtml, /\.pp-title\{[^}]*overflow-wrap:anywhere/);
});

test("public and persona-mode About cards render the escaped profile focus", () => {
  assert.match(indexHtml, /p\.focus\?`<p><b>Focus<\/b><br>\$\{esc\(p\.focus\)\}<\/p>`:""/);
  assert.match(personaView, /p\.focus \? `<p><b>Focus<\/b><br>\$\{esc\(p\.focus\)\}<\/p>` : ""/);
});

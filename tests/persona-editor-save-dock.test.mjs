import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../MyPersonas.Online_v0/index.html", import.meta.url), "utf8");

test("persona editor keeps its save actions in a persistent accessible dock", () => {
  assert.match(html, /class="persona-edit-save-dock" role="group" aria-label="Persona editor actions"/);
  assert.match(html, /\.persona-edit-save-dock\{position:fixed;/);
  assert.match(html, /\.persona-edit-save-dock \.btn\{min-height:44px\}/);
  assert.match(html, /@media\(max-width:820px\)\{\.persona-edit-footer\{padding-bottom:154px\}\.persona-edit-save-dock\{left:50%;bottom:calc\(92px \+ env\(safe-area-inset-bottom\)\);width:calc\(100vw - 24px\)\}\}/);
});

test("hidden field guidance cannot widen the desktop document", () => {
  assert.match(html, /\.field-help-popover\{position:absolute;left:auto;right:0;/);
  assert.doesNotMatch(html, /\.field-help-popover\{position:absolute;left:50%;/);
  assert.match(html, /\.field-help:hover \.field-help-popover,\.field-help:focus \.field-help-popover\{opacity:1;visibility:visible;transform:translateY\(0\)\}/);
});

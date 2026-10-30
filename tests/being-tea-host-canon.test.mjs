import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (value) => readFile(path.join(root, value), "utf8");

test("Being Tea host canon retires Brother Karunya and preserves Akiko family privacy", async () => {
  const [launchPackText, brandHandoff, setupHandoff, receipt, statusHandoff] = await Promise.all([
    read("MyPersonas.Online_v0/content/persona-launch-pack-2026-08-01.json"),
    read("MyPersonas.Online_v0/BRAND-MANAGER-HANDOFF.md"),
    read("MyPersonas.Online_v0/SETUP-CONDUCTOR-HANDOFF.md"),
    read("docs/PR8-CANON-SUPERSESSION-20261030.md"),
    read("status-handoff.md"),
  ]);
  const launchPack = JSON.parse(launchPackText);

  assert.equal(launchPack.publishing_enabled, false);
  assert.ok(Array.isArray(launchPack.personas));
  assert.equal(
    launchPack.personas.some(({ handle }) => handle === "brother_karunya"),
    false,
    "retired host must not remain in the current launch pack",
  );
  assert.doesNotMatch(launchPackText, /Brother\s+K(?:a|\u0101)ru(?:n|\u1e47)ya/i);

  for (const [name, document] of [
    ["brand handoff", brandHandoff],
    ["setup handoff", setupHandoff],
    ["supersession receipt", receipt],
    ["status handoff", statusHandoff],
  ]) {
    assert.match(document, /Akiko Sasaki[\s\S]*public Being Tea Co host/i, name);
    assert.match(
      document,
      /former Brother K(?:a|\u0101)ru(?:n|\u1e47)ya\s*\/\s*`brother_karunya` identity is retired and must\s+not\s+be\s+restored\./i,
      name,
    );
    assert.match(document, /Castleborn family[\s\S]*private-by-default/i, name);
  }

  assert.match(receipt, /56d7b7a56d4463e1f8780ff574bd0c8d0fe31569/);
  assert.match(receipt, /86051bb7d675946833b1ffa12544d3aba040d13d/);
  assert.match(receipt, /owner-phone launch pad[\s\S]*deliberately not ported/i);
  assert.match(receipt, /source\/canon correction only/i);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const designPath = path.join(root, "docs/PR14-NATIVE-FEED-PUSH-SECURITY-DESIGN.md");
const [design, roadmap, mobile, surfaceIndex] = await Promise.all([
  readFile(designPath, "utf8"),
  readFile(path.join(root, "MyPersonas.Online_v0/ROADMAP.md"), "utf8"),
  readFile(path.join(root, "MyPersonas.Online_v0/MOBILE-BLUEPRINT.md"), "utf8"),
  readFile(path.join(root, "docs/SURFACE-RELEASE-AND-MANUAL-INDEX.md"), "utf8"),
]);

test("PR14 is extracted by capability instead of merged wholesale", () => {
  assert.match(design, /must not be merged or cherry-picked as\s+a unit/i);
  assert.match(design, /Migration 078 feed ledger[\s\S]*Redesign before implementation/i);
  assert.match(design, /Migration 079 push ledger[\s\S]*Redesign before implementation/i);
  assert.match(design, /migrations 078\/079 stay unapplied/i);
});

test("private feed design requires authoritative server and owner boundaries", () => {
  assert.match(design, /fresh AAL2 owner\s+session/i);
  assert.match(design, /Direct authenticated table DML stays revoked/i);
  assert.match(design, /SSRF-resistant/i);
  assert.match(design, /bind the outbound connection to that validated resolution/i);
  assert.match(design, /Prompt-injection tests/i);
  assert.match(design, /publishing_enabled=false/i);
  assert.match(design, /Export, retention and erasure/i);
});

test("push capability design prevents browser-readable secrets and implicit actions", () => {
  assert.match(design, /delivery capability/i);
  assert.match(design, /do not list raw\s+endpoints, auth secrets/i);
  assert.match(design, /handles its own newly issued capability transiently/i);
  assert.match(design, /public\/offline PWA shell never prompts/i);
  assert.match(design, /approved push-service endpoint[\s\S]*follows no[\s\n]+redirects/i);
  assert.match(design, /endpoint delivery cannot become an SSRF or DNS-rebinding path/i);
  assert.match(design, /contains no draft body, chat\s+text, fan content/i);
  assert.match(design, /Notification taps do not approve, publish/i);
});

test("alternative native client requires pinned reproducible dependencies", () => {
  assert.match(design, /exact dependency versions, a committed lockfile/i);
  assert.match(design, /Wildcard dependencies and a missing lockfile are release blockers/i);
  assert.match(design, /Preserve the installed Android package and sandbox/i);
  assert.match(mobile, /Gradle 8\.11\.1, Android Gradle Plugin 8\.10\.1 and SDK\/build-tools 36/);
});

test("roadmap and surface index point to the current design", () => {
  assert.match(roadmap, /PR14-NATIVE-FEED-PUSH-SECURITY-DESIGN\.md/);
  assert.match(mobile, /PR14-NATIVE-FEED-PUSH-SECURITY-DESIGN\.md/);
  assert.match(surfaceIndex, /PR14-NATIVE-FEED-PUSH-SECURITY-DESIGN\.md/);
});

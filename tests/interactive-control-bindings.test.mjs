import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every source-authored button is labeled and has a resolvable binding", () => {
  const result = spawnSync(process.execPath, ["scripts/audit-interactive-controls.mjs"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.buttons > 0);
  assert.deepEqual(report.unresolvedHandlers, []);
  assert.deepEqual(report.unlabeledButtons, []);
  assert.deepEqual(report.unboundButtons, []);
  assert.deepEqual(report.suspiciousEmptyLinks, []);
});

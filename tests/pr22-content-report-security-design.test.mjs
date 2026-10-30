import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const designName = "PR22-CONTENT-REPORTS-MODERATION-SECURITY-DESIGN.md";
const [design, roadmap, surfaceIndex, handoff] = await Promise.all([
  readFile(path.join(root, "docs", designName), "utf8"),
  readFile(path.join(root, "MyPersonas.Online_v0", "ROADMAP.md"), "utf8"),
  readFile(path.join(root, "docs", "SURFACE-RELEASE-AND-MANUAL-INDEX.md"), "utf8"),
  readFile(path.join(root, "status-handoff.md"), "utf8"),
]);

test("PR22 is extracted by capability instead of merged wholesale", () => {
  assert.match(design, /must not be merged or cherry-picked as a unit/i);
  assert.match(design, /Migration 080 report\/event tables and RPCs[\s\S]*Redesign before implementation/i);
  assert.match(design, /migration 080 remains unapplied/i);
  assert.match(design, /PR #22 remains a\s+preserved review source rather than a merge candidate/i);
});

test("report intake is bounded, evidence-bound, and free of implicit actions", () => {
  assert.match(design, /Direct table DML stays revoked/i);
  assert.match(design, /UTF-8 byte limits/i);
  assert.match(design, /Missing, invisible and unauthorized targets return one generic error/i);
  assert.match(design, /private, blocked or muted comment\s+author must not make an otherwise visible comment uniquely unreportable/i);
  assert.match(design, /immutable server-authored target evidence reference/i);
  assert.match(design, /creates no moderation, enforcement, provider, notification or\s+publication side effect/i);
  assert.match(design, /untrusted data and untrusted instructions/i);
  assert.match(design, /AI-assisted triage[\s\S]*unable to assign, resolve, enforce or disclose/i);
});

test("staff workflow requires exact authority and complete immutable events", () => {
  assert.match(design, /fresh AAL2 plus the approved moderation\s+authority/i);
  assert.match(design, /conflict\/recusal policy[\s\S]*own account, personas, content or prior action/i);
  assert.match(design, /stable-keyset paged/i);
  assert.match(design, /explicit tri-state operation: unchanged, assign exact eligible\s+staff member, or clear/i);
  assert.match(design, /Direct `open` to `actioned`[\s\S]*stay denied/i);
  assert.match(design, /Append-only must be a database contract/i);
  assert.match(design, /assignment, unassignment, note revision, evidence attachment/i);
});

test("privacy design prevents cascade loss and cross-account disclosure", () => {
  assert.match(design, /must not cascade\s+away unresolved safety evidence/i);
  assert.match(design, /pseudonymization\/tombstones/i);
  assert.match(design, /legal hold is explicit,\s+authorized, auditable and releasable/i);
  assert.match(design, /Staff notes, other reporters, sealed evidence and\s+internal abuse signals do not leak/i);
  assert.match(design, /Restore cannot recreate staff authority/i);
  assert.match(design, /must not cache private report details in\s+the public\/offline shell/i);
});

test("owner and cross-product choices remain explicit release gates", () => {
  assert.match(design, /These choices are intentionally unresolved/i);
  assert.match(design, /Moderator authority/i);
  assert.match(design, /Reporter identity/i);
  assert.match(design, /Retention and legal hold/i);
  assert.match(design, /Cross-product contract/i);
  assert.match(design, /Conflict and recusal/i);
  assert.match(design, /which service owns the canonical report\s+ledger and moderation policy/i);
  assert.match(design, /Authenticated current migration-ledger readback selects a new forward migration/i);
});

test("roadmap, surface index, and root handoff point to the current design", () => {
  for (const source of [roadmap, surfaceIndex, handoff]) {
    assert.match(source, new RegExp(designName.replaceAll(".", "\\.")));
  }
});

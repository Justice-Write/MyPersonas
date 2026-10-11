import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeScopes, safeExpiry, validLedgerId } from "../supabase/functions/_shared/connector/pure.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "supabase/functions/reddit-oauth/index.ts"), "utf8");
const legacyLedgerId = (value) => /^[0-9a-f-]{36}$/i.test(value);

function redditGrantedScopes(value) {
  return String(value ?? "").split(/[ ,]+/).filter(Boolean)
    .filter((scope) => normalizeScopes(scope).includes(scope));
}

function historicalScopes(value) {
  return String(value ?? "").split(/[ ,]+/).filter(Boolean);
}

test("reddit-oauth imports the shared pure helpers", () => {
  assert.match(source, /import \{ normalizeScopes, safeExpiry, validLedgerId \} from "\.\.\/_shared\/connector\/pure\.ts"/);
  assert.match(source, /validLedgerId\(ledgerId\) \|\| \/\^\[0-9a-f-\]\{36\}\$\/i\.test\(ledgerId\)/);
  assert.match(source, /normalizeScopes\(scope\)\.includes\(scope\)/);
  assert.match(source, /safeExpiry\(undefined, relativeExpiry\)/);
  assert.match(source, /supabase functions deploy reddit-oauth --no-verify-jwt/);
});

test("ordinary Reddit ledger ids, scopes, and expiries stay on the previous results", () => {
  const samples = [
    "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "not-a-ledger",
    "",
  ];
  for (const sample of samples) {
    assert.equal(validLedgerId(sample) || legacyLedgerId(sample), legacyLedgerId(sample), sample);
  }
  for (const scopes of ["identity submit read", "identity,submit", "read identity submit"]) {
    assert.deepEqual(redditGrantedScopes(scopes), historicalScopes(scopes), scopes);
  }
  const now = 1_700_000_000_000;
  for (const expiresIn of [3600, 86400]) {
    assert.equal(
      safeExpiry(undefined, expiresIn, now),
      new Date(now + Math.max(60, expiresIn) * 1000).toISOString(),
    );
  }
  assert.equal(safeExpiry(undefined, 3600, now) || new Date(now + Math.max(60, 3600) * 1000).toISOString(), new Date(now + 3600 * 1000).toISOString());
});

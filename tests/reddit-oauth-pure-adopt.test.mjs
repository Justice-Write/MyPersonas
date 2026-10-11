import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeScopes, safeExpiry, validLedgerId } from "../supabase/functions/_shared/connector/pure.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "supabase/functions/reddit-oauth/index.ts"), "utf8");
const legacyLedgerId = (value) => /^[0-9a-f-]{36}$/i.test(value);

// Execute the actual production expression rather than a parallel test copy.
const scopeExpression = source.match(/const grantedScopes = ([\s\S]*?);\s*if \(!grantedScopes/)[1];
const evaluateScopes = new Function("token", "normalizeScopes", "return " + scopeExpression);
const redditGrantedScopes = value => evaluateScopes({ scope: value }, normalizeScopes);

function historicalScopes(value) {
  return String(value ?? "").split(/[ ,]+/).filter(Boolean);
}

test("reddit-oauth imports the shared pure helpers", () => {
  assert.match(source, /import \{ normalizeScopes, safeExpiry, validLedgerId \} from "\.\.\/_shared\/connector\/pure\.ts"/);
  assert.match(source, /validLedgerId\(ledgerId\) \|\| \/\^\[0-9a-f-\]\{36\}\$\/i\.test\(ledgerId\)/);
  assert.match(source, /normalizeScopes\(scope\)\.find\(/);
  assert.match(source, /safeExpiry\(undefined, relativeExpiry\)/);
  assert.match(source, /supabase functions deploy reddit-oauth --no-verify-jwt/);
});

test("ordinary Reddit ledger ids, scopes, and expiries stay on the previous results", () => {
  const samples = [
    "-".repeat(36),
    "a".repeat(36),
    "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "not-a-ledger",
    "",
  ];
  for (const sample of samples) {
    assert.equal(validLedgerId(sample) || legacyLedgerId(sample), legacyLedgerId(sample), sample);
  }
  for (const scopes of ["identity submit read", "identity,submit", "read identity submit", "identity submit read read", "identity submit odd/scope", "identity\tsubmit", "identity submit " + "x".repeat(129)]) {
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

test("actual Reddit expiry expression preserves defaults, clamps, and historical errors", () => {
  const expression = source.match(/const relativeExpiry = ([\s\S]*?);\s*const \{ error: storeError \}/)[1];
  const now = 1_700_000_000_000;
  class FixedDate extends Date {
    static now() { return now; }
  }
  const evaluate = new Function("token", "safeExpiry", "Date", `const relativeExpiry = ${expression}; return expiresAt;`);
  for (const value of [undefined, null, 0, "", false, 1, -1, 59, 60, 3600, "3600", 34560001, "invalid", Infinity]) {
    const previous = () => new Date(now + Math.max(60, Number(value || 3600)) * 1000).toISOString();
    const current = () => evaluate({ expires_in: value }, (absolute, relative) => safeExpiry(absolute, relative, now), FixedDate);
    let expected;
    try { expected = previous(); } catch (error) {
      assert.throws(current, { name: error.name });
      continue;
    }
    assert.equal(current(), expected, String(value));
  }
});

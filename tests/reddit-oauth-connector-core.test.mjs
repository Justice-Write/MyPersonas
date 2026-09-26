// P2 connector-core step 2: reddit-oauth adopts the shared pure helpers instead of
// inline duplicates. Source-level checks (the function itself needs Deno + secrets)
// plus behavior checks of the shared helpers on Reddit-shaped inputs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeScopes, safeExpiry, validLedgerId } from "../supabase/functions/_shared/connector/pure.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "supabase/functions/reddit-oauth/index.ts"), "utf8");

test("reddit-oauth imports the shared connector pure helpers", () => {
  assert.match(source, /import \{ normalizeScopes, safeExpiry, validLedgerId \} from "\.\.\/_shared\/connector\/pure\.ts";/);
});

test("reddit-oauth no longer inlines the duplicated ledger-id, scope, or expiry logic", () => {
  assert.doesNotMatch(source, /\/\^\[0-9a-f-\]\{36\}\$\/i/);
  assert.doesNotMatch(source, /split\(\/\[ ,\]\+\/\)/);
  assert.doesNotMatch(source, /Math\.max\(60, Number\(token\.expires_in/);
  assert.equal((source.match(/!validLedgerId\(ledgerId\)/g) || []).length, 2);
  assert.match(source, /const grantedScopes = normalizeScopes\(token\.scope\);/);
  assert.match(source, /safeExpiry\(undefined, token\.expires_in\) \|\|/);
});

test("shared helpers accept Reddit-shaped values", () => {
  assert.deepEqual(normalizeScopes("identity submit read"), ["identity", "read", "submit"]);
  assert.deepEqual(normalizeScopes("submit,identity identity"), ["identity", "submit"]);
  assert.deepEqual(normalizeScopes(undefined), []);
  assert.equal(validLedgerId("1e8b9288-a938-4c98-8988-8e0cc9835123"), true);
  assert.equal(validLedgerId("------------------------------------"), false);
  const now = 1_000_000_000_000;
  assert.equal(safeExpiry(undefined, 86400, now), new Date(now + 86_400_000).toISOString());
  assert.equal(safeExpiry(undefined, 5, now), "");
  assert.equal(safeExpiry(undefined, undefined, now), "");
});

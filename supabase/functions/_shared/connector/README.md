# Shared connector core

First slice of the refactor in `MyPersonas.Online_v0/CONNECTOR-CORE-DESIGN.md`.
Goal: stop re-implementing token/identity/parse/validation logic in every OAuth
connector (meta-oauth, gmail-oauth, twitter-oauth, reddit-oauth).

## Contents

- `pure.ts` — pure, I/O-free helpers shared across connectors: `validProviderId`,
  `validLedgerId`, `normalizeScopes`, `safeExpiry`, `instagramAssetFromLinked`,
  `parseBindings`, `normalizeEmail`. No Deno globals, so it's unit-testable in Node.

## Status

- **Adopted by `reddit-oauth` only, and not deployed.** That function imports
  `validLedgerId`, `normalizeScopes`, and `safeExpiry`. Ordinary ledger UUIDs,
  Reddit scope strings, and `expires_in` values keep the previous results. The
  historical 36-character ledger check stays in place beside `validLedgerId`, so
  ids the function already forwarded still reach Postgres. No other function
  imports this module, and this change does not deploy `reddit-oauth`.
- **Tested directly:** `tests/pure-core.test.mjs` imports this real `.ts` file (via
  Node's `--experimental-strip-types`) — no mirrored copy to drift. `npm test`.

## How to adopt (incremental, one function at a time)

1. In a connector (start with a simple one, e.g. reddit-oauth), replace its inline
   copy of a helper with an import:
   `import { validProviderId } from "../_shared/connector/pure.ts";`
2. Delete the now-duplicate inline definition.
3. `deno check supabase/functions/<name>/index.ts` and run the connector's flow.
4. Deploy that one function, verify, then repeat for the next connector.
5. Once every connector imports from here, remove the parallel copy in
   `tests/lib/meta-helpers.mjs` and point those tests at this module too.

## Next slices (design doc)

- `http.ts` — `fetchJson` (timeout, redirect:"error", provider-error normalization,
  retry/backoff for 429/5xx) + a `graphGet`-style helper. Standardize on field
  expansion over N+1 per-item calls (the IG fix).
- `respond.ts` — CORS, `json()`, `redirectToApp()`, allowed-origins.
- `revocation.ts`, `leases.ts`, `vault.ts`, `identity.ts` — see design doc.

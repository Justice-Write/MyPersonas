# Domain split: aliaspaces.com and mypersonas.online

Owner ruling, 2026-10-31:

- **aliaspaces.com** is the social media site.
- **mypersonas.online** is reserved for managing the AI-assisted persona
  platform that runs inside AliaSpaces.

The owner chose to serve the current live site on both domains and split it by
view, rather than wait for the independent AliaSpaces client.

## How it works

Both domains serve the same `MyPersonas.Online_v0` build.
`MyPersonas.Online_v0/domain-split.js` loads first and decides which domain owns
the current view.

| View | Lives on |
| --- | --- |
| `p/…`, `b/…`, `tag/…`, `search/…`, `friend-invite/…` | aliaspaces.com |
| Discover (`#/`) and Persona view (`#/owner` while acting as a persona) | aliaspaces.com |
| Owner workspace: `owner` (Overview), `create`, `library`, `studio`, `edit`, `review`, `persona-settings`, `business-settings`, `agent-board`, `platform-queue`, `briefs`, `schedule`, `fan-inbox`, `activity`, `notifications`, `discovery`, `onboard` | mypersonas.online |
| `signin` | both (each domain has its own sign-in) |

The owner-workspace list is `PERSONA_VIEW_OWNER_ROUTES` in `persona-view.js`.
`tests/domain-split.test.mjs` fails if the two lists drift.

- Opening a view on the wrong domain sends the visitor to the right one with the
  same hash. Views that do not depend on the session leave before the app boots.
- Every cross-domain hop carries `?hop=1`. The arriving page never sends that
  same view straight back and removes the marker from the address bar. A stale
  deployment on either side therefore cannot cause a redirect loop.
- aliaspaces.com always opens in Persona view when the account has a persona.
  Choosing Overview opens mypersonas.online.
- mypersonas.online always opens in Overview. Choosing Persona view opens
  aliaspaces.com. Signed in, `#/` goes to the owner home; signed out, it shows the
  MyPersonas landing.
- Share and friend-invite links always use aliaspaces.com.
- Any other host (localhost, previews, tests) keeps every view and never
  redirects.

## Limits

- Sign-in is per domain. The same account works on both, but a session on one
  domain does not sign you in on the other. No token is passed between them.
- Supabase Auth must list `https://aliaspaces.com/**` and
  `https://www.aliaspaces.com/**` as redirect URLs before aliaspaces.com serves
  the site. Otherwise Google and magic-link sign-in fall back to the Site URL.
- Provider OAuth callbacks stay on mypersonas.online, where the Matrix/studio
  view lives.
- The management manifest, Apple title, offline page and structured metadata identify MyPersonas. The AliaSpaces builder materializes social identity from the same exact source pin, preserving manifest id/scope/start_url. Runtime metadata follows the current host. The public-shell cache version is bumped; owner code remains outside the offline cache.

## Release order

1. Owner adds the aliaspaces.com redirect URLs in Supabase Auth.
2. Merge this change into `main`. Merging does not deploy mypersonas.online; the
   gated Pages release does.
3. In the aliaspaces.com repository, pin `SOCIAL-SITE-SOURCE.json` to the merged
   `main` commit and merge. aliaspaces.com then serves this build.
4. Check aliaspaces.com, then run the normal gated MyPersonas Pages release so
   mypersonas.online picks up the split.

Rollback: aliaspaces.com can redeploy its old redirect page from its Pages
workflow (`artifact: front-door`). The `?hop=1` rule keeps that safe while
mypersonas.online already has the split.

## November 2 reconciliation and verification

Reconciled98ca542 onto main6b099fc plus24 unsubscribe regressionsdaacf6a; no082,
reports or relationship-memory changes included. Management default identity is
MyPersonas; social build identity remains AliaSpaces. Both canonical/OG URLs omit
private route/query/token data. Same-origin OAuth code/error callbacks finish before
cross-domain routing, and callback parameters are never forwarded.

Executable actual-router cases cover guest/signed-in roots, owner versus persona
home, library, public persona/business/invite, both sign-in surfaces, MFA readiness,
wrong-host departure, host metadata and callback preservation. Six full-source-page
headless Edge checks render both roots/sign-in pages and cross-domain library/search
using synthetic signed-out auth and intercepted network. These do not establish
real authenticated return/MFA, provider, browser storage or live-data acceptance.

GitHub workflow identity guard accepts only the exact backend workflow path, bare
or suffixed @refs/heads/main. Exact SHA/main/event/status/success checks, exact
artifact contents and private canary confirmation remain mandatory.

Release coordinator owns final merge, exact-main backend receipt, authentication
redirect allowlist, private canary and deployment order. This source lane does not
perform those actions. Local regression-only publication hold is superseded for
this release candidate by the owner's November2 finish/test/deploy authorization.

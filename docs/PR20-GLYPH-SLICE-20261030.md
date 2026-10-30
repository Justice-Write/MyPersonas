# PR20 platform-glyph slice receipt

**Prepared:** 2026-10-30
**Current-main base:** `a5862826ba25d480df61bbc0e312234a72dc71a3`
**Source reviewed:** PR20 head `0af1ef31182b508dfa950fb3d88231433333e6b4`

## Scope carried forward

This slice ports only PR20's platform-glyph work onto current main:

- 42 inline `i-plat-*` symbols, one for each current `PLATS` identifier;
- matching standalone SVG assets plus the frozen typed component map originally added by
  PR20 commit `e121340`;
- the bounded `platformGlyph()` helper and current public-link, edit-link, account-ledger,
  persona-view and owner-portal consumers originally introduced with PR20 commit `ae23812`;
- exact Pages allowlist coverage and focused tests for catalog coverage, inert SVG content,
  sprite/standalone parity, fixed component output, UI consumers and cache boundaries.

The glyphs are checked-in simplified line drawings using `currentColor`; they were copied
from PR20, not downloaded from provider sites. Third-party platform names and identifying
marks describe the represented services and do not imply affiliation or endorsement.

## Deliberately not carried forward

PR20 cannot be superseded by this slice alone. The following remain separately reviewable:

- the native `prompt` / `confirm` / `alert` replacement framework and its broad call-site
  conversion;
- Reddit OAuth shared-helper adoption or any other provider/backend behavior;
- the old synthetic CG screenshots and their historical review note;
- unrelated owner-home, route, connector, governance or test changes from the old branch.

No account was accessed, no credential was handled, no migration or provider action ran,
and no deployment, publication or installation occurred. `publishing_enabled=false` remains
unchanged.

## Review boundary

The standalone SVGs prohibit active content and external references, remain at or below
2 KiB each, and must exactly contain the corresponding inline sprite body. The glyph map is
frozen and emits only fixed `ico("plat-…")` references. Unrecognized platform values fall
back to the existing `other` identifier through a catalog membership check.

The glyph assets are included in the Pages artifact but intentionally excluded from
`PUBLIC_SHELL_PATHS`. That service-worker boundary continues to avoid runtime caching of the
signed-in application and private owner workflow.

## Current-main verification

- complete Node suite: 569/569 passing;
- focused glyph, PWA, package-verifier and package-audit suite: 22/22 passing;
- frontend inline-script syntax: passing;
- materialized Pages artifact: 125 exact-source members;
- package audit: `BYTE_PARITY_ONLY`, 0 failures and 40 pre-existing media/archive
  review-required flags;
- `git diff --check`: passing.

These checks are source/package evidence only. They do not certify media consent, provider
credentials, deployment, installation, visual appearance or signed-in owner workflows.

## Acceptance still required

- ordinary code review and merge onto then-current main;
- hosted CI for the exact review revision;
- visual inspection of every glyph at chip, account-ledger and owner-portal sizes;
- deployed byte/readback and signed-in acceptance only as part of the separately authorized
  release process.

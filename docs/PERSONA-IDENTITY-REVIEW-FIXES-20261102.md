# Persona identity and owner preview review fixes

Status: committed and pushed in [PR52](https://github.com/Justice-Write/MyPersonas/pull/52), awaiting hosted CI and coordinator review. Source candidate from deployed MyPersonas revision `a1fa8a61836972ed88b1a4fbf9c885af0c3075c9`. Deployment, merged-source packaging and live readback belong to the coordinated two-site release. This document does not assert those later steps have happened.

## Review disposition

The four findings in [PR49 review](https://github.com/Justice-Write/MyPersonas/pull/49#pullrequestreview-5743010147) remained present in the deployed revision. The desktop Entangle navigation inconsistency noted in that review was also confirmed.

| Trigger | Previous behavior | Candidate behavior |
| --- | --- | --- |
| Owner selects B in MyPersonas, destination previously selected A | Social host activates A | Transfer B as a non-secret fragment ID; validate against the destination authenticated owned roster before activating B |
| Saved or incoming actor is absent, deleted or foreign | First remaining persona can become active | Stay inactive and show an explicit actor chooser; invalid incoming intent overrides any saved actor |
| Owner uses Matrix View or Save & view for unpublished B | Public profile route leaves management and applies another actor's visibility | `owner-preview/<handle>` remains a management route, verifies session/assurance/owned handle, and uses the existing owner page renderer |
| Desktop Entangle clicked on management host | Returns to management home | Uses the existing Discover navigation helper |
| Browser fixture runs on POSIX | Backslash-only containment rejects valid files | Platform-independent relative-path containment, realpath symlink containment and malformed/traversal refusal |

## Cross-site contract

The control host sends `https://aliaspaces.com/#/owner/<UUID>` only after checking the exact current owned selection and private-session readiness. No credentials, tokens or account ID are transported.

The domain script captures the fragment ID before app bootstrap, removes it from the address bar and holds it in this tab's session storage for at most 15 minutes. This allows a same-tab sign-in/MFA reload. Authenticated roster restoration consumes it once, after the existing private-session assurance gate. The intent takes precedence over origin-local saved selection, including when malformed, expired or no longer owned. Failed validation clears the social saved selection and stays inactive. A valid saved actor can still be restored on a later ordinary visit when its saved mode is Persona view. Management's display-only first-persona default does not become a social actor implicitly.

Social `#/owner` now also hosts the inactive actor chooser; it does not automatically redirect to management. The explicit Overview button still opens MyPersonas. Public `p/<handle>` and share links remain social; owner previews do not weaken SQL visibility or publication rules. A preview URL opened on the social host returns to management even when a hop marker is present.

The intent is per tab. Moving authentication to a different tab does not transfer this navigation intent; no cross-tab or real-provider acceptance is claimed. Storage failure, expired intent and unavailable ownership require explicit selection rather than a guaranteed automatic switch.

## Verification

- `npm test`: **1003/1003 pass**, including 30 new executable identity, preview and containment cases.
- Ten delayed preview completions cover logout, account changes, revoked readiness, auth generation changes and removed roster membership at both asynchronous phases. No stale private DOM writes.
- `node scripts/check-frontend-syntax.mjs`: pass.
- `scripts/qualify-persona-handoff-browser.mjs <playwright-module> <browser-executable>`: **6/6 pass** in Edge 156.0.4314.50. Actual cross-origin navigation, separate origin storage, reload durability, old A/empty/deleted destination state, unavailable B and a pre-roster sign-in reload are exercised. 25 fixture navigations; zero network continuations.
- `scripts/qualify-domain-browser.mjs <playwright-module> <browser-executable>`: **7/7 pass**, including the prior six full-source signed-out smoke checks and unpublished sibling B's management preview with A selected.
- Containment tests exercise Windows and POSIX path semantics, sibling/traversal/malformed paths and an actual symlink/junction escape. Native Linux browser execution remains untested locally; CI runs the Node suite on Linux.
- `git diff --check`: pass.

Browser authentication, MFA readiness and roster data are synthetic. All browser requests are locally fulfilled or aborted; no live account, social mutation, model/provider request, backend/schema change or installation occurred. Existing deployment parity and canary evidence are historical evidence for their exact revisions, not acceptance of this source candidate. Backend and image-caption helper sources are unchanged by this patch. The ordinary public-shell cache version advances to `2026-11-02-3`; cache prefix, activation and private-data exclusion rules are unchanged.

## Next owner

Review and merge the source PR through the coordinator, combine the disjoint release-guard lane, pin AliaSpaces to the final merged revision, build both exact-source artifacts and deploy through the coordinated release workflow. Read back both sites and retain clear separation between source tests, live deployment evidence and physical-device acceptance. Keep private runtime records outside reusable packages and preserve the dirty canonical checkout.

# Native-dialog disposition — 2026-10-30

Baseline main: `1dddca219d5fae69ce975ecb129e6cd3caf962f7`.

The previous 99 count represented **99 real native calls in 85 function groups**,
not 99 independent tasks. Source review found no comment/string false positives
within that count. This continuation converts **94 calls in 82 groups**; five
calls in three browser-dependent flows retain their existing native behavior.
The full per-function baseline locations and dispositions are in
[NATIVE-DIALOG-DISPOSITION-20261030.json](NATIVE-DIALOG-DISPOSITION-20261030.json).

| Group | Baseline calls | Converted | Retained |
| --- | ---: | ---: | ---: |
| Owner/editor, account, draft and provider client workflows (`index.html`) | 67 | 63 | 4 |
| Agent board | 7 | 7 | 0 |
| CMS draft controls | 5 | 5 | 0 |
| Governance | 20 | 19 | 1 |
| Total | 99 | 94 | 5 |

## Completed local implementation

- Every converted caller awaits the shared dialog. Cancellation remains a cancel;
  optional empty answers retain their existing meaning. Synchronous editor event
  handlers were converted only where their callers do not consume a return value.
- Confirmation guards bind the initiating owner, view and captured inputs/state.
  Prompt results and existing MFA gates are checked again before mutation. Stale
  decisions fail closed; the owner can reopen the action against current state.
- Agent decisions bind the queue item and review packet, settings and exact budget
  fields. Run admission rechecks after confirmation, MFA and bearer-session lookup.
- CMS controls retain exact draft/site confirmations, expected provider identifiers,
  local-versus-provider revocation wording and recovery/checkpoint behavior.
- Governance guards retain the reviewed persona/business/feature/extension state;
  destructive confirmations keep Cancel-first semantics.
- Eleven existing browser request helpers now capture the initiating owner/view
  before `getSession()` and reject a mismatched session or changed view before
  issuing HTTP. These client checks are stale-action protection, not server
  authorization. No provider endpoint, scope, schema, SQL, server permission or
  publishing capability was added. `publishing_enabled` remains false.
- Guard snapshots are transient in-memory comparisons. They are not logs, exports,
  browser persistence, installer data or training input.

The [Supabase getSession reference](https://supabase.com/docs/reference/javascript/auth-getsession)
was checked: it supplies the raw session from client storage and may refresh it.
Server authentication, AAL2, exact account binding and RLS remain authoritative.
No database or provider query was run for this source-only change; verification
uses synthetic sessions and mocked requests under the no-live-operations boundary.

## Deliberately retained browser-dependent flows

| Function | Calls | Existing behavior retained | Evidence needed before replacement |
| --- | ---: | --- | --- |
| `governanceCopyBusinessReview` | 1 | Native confirmation immediately precedes copying the exact public-intended review packet. | Chromium/WebView clipboard user activation, failure fallback, exact packet and changed-owner checks. |
| `mailboxUnsubscribe` | 3 | Native confirmation around destination inspection and opening an external HTTPS destination or mail client. | Browser popup/URI-handler activation, cancel behavior, destination/account binding and no automatic mail send. |
| `handleOAuthReturn` | 1 | Native model-name prompt within the existing same-browser OpenRouter return/session flow. | Synthetic same-browser callback/PKCE/session-replacement tests plus signed-in browser return acceptance before changing its continuation timing. |

These are **three explicit browser-integration gates**, not 5 unspecified tasks or
99 owner decisions. The current source-only lane prohibits UI, account/provider
and device operations, so it preserves these existing native boundaries.
No claim is made that they have fresh browser acceptance. The separate
`promptEvent.prompt()` PWA install API is not a text dialog and must remain intact.

## Remaining product and release gates

Reddit helper compatibility and PR22 moderation/receipt decisions are separate
from dialog conversion. They were not invented or bypassed to reduce the count.
Authenticated Chromium, Android WebView and assistive-technology acceptance of
converted flows remains required. Current ledger evidence, an exact-source backend
artifact and the private canary precede Pages release. Installing the existing
production PWA does not deploy or accept this source.

## Verification

Executable regressions cover delayed answers, cancellation, owner/view/auth changes,
changed entities/forms, MFA handoffs, exact accepted operations and session lookup
races. Static disposition checks prevent new unclassified native calls. Full local
suite and final hosted checks are recorded in the root handoff and PR receipt.
No foreground UI, private data, provider, database, migration or device operation
was used to satisfy these checks.

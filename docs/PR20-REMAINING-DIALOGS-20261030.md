# Remaining native dialogs and friendship invite slice

> Superseded inventory: [the complete disposition](NATIVE-DIALOG-DISPOSITION-20261030.md) accounts for the later 99-call baseline. The continuation converts94 calls in82 function groups and retains5 calls in3 explicitly browser-gated flows. Counts below describe earlier checkpoints.

Baseline: main `35ee29c102321c810d1e5c9a06a5fa12090fc9b8`.
PR20 remains a preserved review source, not a merge candidate in its entirety.

## Landed behavior in this slice

The persona friendship invite-proof flow awaits the shared in-app prompt. It
retains the captured actor and target, trims only the resolved string, and checks
the actor snapshot again before requesting friendship. Cancel, blank input and a
changed owner/persona cause no mutation. Open-policy requests and the unsupported
contact-proof boundary retain their existing behavior. The script URL version is
bumped so online clients can fetch the changed file when this source is deployed.

Seven executable tests exercise the actual function in a synthetic VM, including
a deliberately unresolved input promise and a changed actor while it is pending.
The focused persona-view suite passes 16 tests; the full suite passes 587 tests.
Frontend inline syntax and whitespace checks pass. These are source checks, not
authenticated browser, Android WebView, screen-reader or production acceptance.

## Remaining inventory

After this slice, a lexical scan of top-level website `.js` and `.html` files for
unqualified `alert`, `confirm` and `prompt` calls finds the following candidates:

| File | Candidate calls | Conversion concerns |
| --- | ---: | --- |
| `agent-board.js` | 7 | Exact packet hash, queue status, budget values and owner must still match after input. No spending approval may transfer to a changed request. |
| `cms-connector-ui.js` | 5 | Preserve the exact draft and target confirmations separately. Revalidate connection, target and draft after each prompt and after MFA. |
| `creative-workspace.js` | 0 | Converted in the creative-dialog follow-up below; device/browser acceptance remains open. |
| `index.html` | 67 | Split page-builder/local edits from destructive, publishing, provider and automation actions. Synchronous helpers need their callers audited before becoming async. |
| `platform-governance.js` | 20 | Revalidate persona/business, exact review packet, publication state and sensitive-action authority. Clipboard operations also need browser user-activation verification. |

Total after the creative-dialog follow-up: 99 lexical candidates. This count is a triage aid, not an AST inventory or
proof of runtime reachability. It excludes qualified calls and nested directories.
`promptEvent.prompt()` in `pwa.js` is the browser install API and must not become an
application text prompt. `persona-view.js` and `owner-app.js` have no remaining
unqualified native-dialog candidates in this scan.

## Next implementation order

1. Take one caller group at a time. Capture the authorized entity and displayed
   inputs before awaiting; revalidate them before the first side effect. Do not
   turn a Promise into a truthy confirmation or call `.trim()` on a Promise.
2. For each group, exercise cancel, delayed answer, changed owner/entity, repeated
   clicks and route teardown. Destructive dialogs must keep Cancel-first focus.
3. Verify the shared primitive and each accepted group in authenticated Chromium,
   Android WebView and assistive technology. Input proofs must not enter logs,
   analytics, persistent browser state or public package evidence.
4. Keep Reddit helper adoption separate. This slice changes no provider endpoint,
   requested scopes, token handling or historical compatibility policy; permissive
   UUID/scope/expiry fallbacks from PR20 remain unported.

The previous exact-main package is preserved. This source change requires a new
package and exact-revision backend/canary evidence before Pages release. No device
installation, migration, provider send or live friendship operation occurred.

## Creative-dialog follow-up

The three creative workspace confirmations now await the shared dialog. A common
confirmation guard validates owner, route, workspace generation and Overview mode
before opening and again before any side effect. Removal additionally rechecks the
currently displayed asset, its owner, title and storage path. Saved references use
a captured resource rather than mutable caller data. Existing endpoint/action,
private-file deletion order, unreviewed status and training-disabled defaults stay
in place; the script cache version is bumped.

Twenty-one executable regressions cover pending confirmation, cancellation,
owner/route/generation/perspective switches, removed/replaced assets, changed detail
panels, exact accepted operations and resource mutation while awaiting input.
Focused creative suites pass 29/29; full suite passes 608/608; inline/external
syntax and whitespace checks pass. The existing browser fixture's confirmation
stub is now asynchronous. That browser fixture was not rerun; no foreground UI,
provider, storage, database or installed-device operations occurred. Real browser,
WebView and accessibility acceptance remain open. Source base is PR45 main
`f513223b0e7627c06db8268c3fe3d11e5776cfe8`; its prior package remains historical once
this follow-up is merged, and release requires a newly verified exact-source package.
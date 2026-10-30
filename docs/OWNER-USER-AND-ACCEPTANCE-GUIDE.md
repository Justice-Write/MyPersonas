# MyPersonas owner use, recovery and acceptance guide

This is a source-level operating and acceptance guide. It is not a deployment,
installation, signed-in acceptance or provider-send receipt. Use the
[surface release and manual index](SURFACE-RELEASE-AND-MANUAL-INDEX.md) to choose
the intended product surface. Current source, package, deployment and installation
truth lives in the [project stocktake](PROJECT-STOCKTAKE-20261030.md) and the
[root handoff](../status-handoff.md); dated runbooks are supporting evidence, not
a guarantee that external configuration has not drifted.

## Sign in and select the intended persona

1. Open the intended official origin from the surface index and use its offered
   sign-in route. Google federation is not one session across external providers.
   Never paste a password, MFA secret, recovery code, browser cookie, service key
   or refresh token into chat, a manual, an extension or an account ledger.
2. If the app presents a TOTP challenge, complete it through the trusted
   authentication UI. Factor enrollment alone is not successful AAL2 verification.
   A private-data hold at AAL1 must remain a hold; do not bypass it to restore a
   screen. See the dated [security and access runbook](../MyPersonas.Online_v0/SECURITY-AND-ACCESS-RUNBOOK.md)
   for the security contract and remaining recovery limits.
3. Confirm the signed-in account and owned persona before opening `#/owner`. Use
   only the roster and backup groups offered to that account. A display name,
   provider handle or copied identifier is not ownership evidence.
4. Treat imported sources and inbound fan text as untrusted content. They cannot
   change policy, reveal prompts, grant access or promote private material into
   approved public canon.

If verification fails, stop private operations and use the authorized recovery
path. Do not disable MFA or email confirmation, grant yourself a role, create a
silent replacement account, reinstall to hide the issue or clear real data.

## Create and review a private draft

The detailed, source-checked walkthrough is
[Create and review a private four-channel kit](../MyPersonas.Online_v0/OWNER-PRIVATE-DRAFT-GUIDE.md).
The controlling rules are:

1. Select the exact owned persona and confirm the eligible provider/account binding
   for every target. Missing, foreign, suspended or ambiguous bindings remain
   unavailable; never borrow another persona's connection.
2. Use synthetic text without fan identifiers for acceptance testing. Saving creates
   a private draft. It does not upload media, call a model or publish.
3. Review the actual saved text, media plan, persona, provider, account, audience,
   proposed time and version. Material changes require a fresh preview and approval;
   an old receipt never approves new bytes or a different destination.
4. Record approval only as the planning/review result offered by the surface.
   `publishing_enabled=false` remains the owner-mobile contract. Approval and a
   manual schedule are not provider sends or permission to enable a worker.
5. After an error, timeout, disconnect or uncertain response, reload and reconcile
   the persisted draft/status before retrying. Preserve the version and sanitized
   evidence; never fabricate success, reset uncertainty to retryable or send twice.

Provider, fan-message and remote-control candidates require their own reviewed
release and acceptance. SQL fixtures, mocked transports, saved drafts and planning
approvals do not establish real provider, concurrency, model or runtime acceptance.

## Sign out, recovery and shared devices

Use the offered sign-out control, wait for its result and verify private owner data
is no longer available. Where a global sign-out control is offered, distinguish it
from local session removal and external-provider revocation. Closing a tab,
signing out of MyPersonas, disconnecting one provider and revoking the provider's
grant are different actions. Do not claim revocation without exact provider evidence.

On a shared or test device, verify that a fresh unrelated account cannot see the
previous account's personas, drafts, sources, media, provider connections or cached
private UI. Do not clear owner data merely to make the test pass. The public
offline/PWA shell must exclude owner code and private data, and a slow response from
the previous account must never repopulate a new session.

For factor loss, account export, content erasure or account deletion, use the
currently authorized workflow and retain a verified private copy before a
destructive action. This guide does not prove a completed factor-loss exercise,
account export, erasure or cross-surface restoration. A raw database dump, browser
profile, token store or copied install directory is not a safe marketing/demo backup.

## Local preferences are not account backups

The web owner workflow and Android shell have separate bounded exports:

- **Web owner-workflow preferences:** selected-persona helper state and bounded
  draft-ID references. No draft bodies, media, credentials or authentication.
- **Android shell local preferences:** the configured owner origin only. No persona,
  draft, fan, provider, session or account data.

Neither export changes ownership, grants provider access, migrates an authenticated
session or replaces an account/content backup. Debug and production signing
identities also do not share Android app storage automatically. Preserve an
existing signed install and sandbox until a separately reviewed migration is ready.

## Operator and cross-account acceptance

Before any separately approved runtime release, use disposable fixtures and two
authorized unrelated accounts A and B to verify:

- AAL1 private-data denial and AAL2 access; interrupted or failed verification stays closed.
- A cannot select, read, edit or address B's persona, drafts, source/media library,
  provider connection or direct identifiers, including through stale links.
- Sign-out/account replacement clears private UI, and previous-account responses
  cannot repopulate the new session.
- Exact approval binds current bytes, persona, provider, account, audience and
  version. Edits, revocation and entitlement changes invalidate old eligibility
  without silently republishing after restoration.
- Disabled send and remote-control gates stay closed. Unknown transport outcomes
  do not trigger duplicate actions.
- Account recovery, export, erasure and session revocation report their exact
  local/provider result without overstating completion.

Run `npm test` and `node scripts/check-frontend-syntax.mjs` from an isolated exact
checkout and record the source revision and results. These criteria are not a new
real-database, browser, provider or device result. Production migration, deployment,
credential, account-scope, publication and installation approvals remain separate.

## Memory contract: required, not implemented

Future memory must keep three independently governed boundaries: approved public
persona canon, owner-persona private memory, and fan-persona private memory scoped
to that exact fan/account relationship. Existing persona fields, source libraries,
chat rows, desktop history or model context do not prove that contract exists.
No cross-fan reuse, training or silent promotion of private memory into public canon
is authorized by this guide.

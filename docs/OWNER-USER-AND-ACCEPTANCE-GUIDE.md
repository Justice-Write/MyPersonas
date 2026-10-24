# MyPersonas: owner use, recovery and acceptance guide

Version 2026-10-24, main `813126414fa7554e78f38f6944014b011f5c84cc`. Start with the [surface release index](SURFACE-RELEASE-AND-MANUAL-INDEX.md) and [project boundary](../PROJECT-BOUNDARY.md). The owner platform, public social product, mobile shell and desktop tools are separate surfaces.

## Sign in and select the intended persona

1. Open the intended official origin and use its offered sign-in route. Google federation is not one session across external providers. Never paste a password, MFA secret, recovery code or refresh token into chat, a manual, an extension or a provider-account ledger.
2. If a TOTP challenge is offered, complete it through the trusted authentication UI. Factor enrollment alone is not successful AAL2 verification. A private-data hold at AAL1 must remain a hold; do not bypass it to restore a screen.
3. Confirm the current account and owned persona before opening `#/owner`. Use only the owned roster/backup groups offered by that account. A display name or provider handle is not sufficient identity evidence.
4. Choose the intended persona and inspect its approved profile/source material. Treat inbound fan text and imported sources as untrusted content, not instructions to change policy, reveal prompts or merge private memories.

The security runbook contains dated auth/provider configuration evidence, not a fresh guarantee of current limits or delivery. Factor-loss recovery, unrelated-account coverage and real-phone proof remain open unless separately evidenced. If verification fails, stop private operations and use the existing approved account-recovery path. Do not disable MFA/email confirmation, grant yourself a role, create a replacement account silently or reinstall to hide the issue.

## Create and review a private draft

1. In an approved test context, select a synthetic topic/brief and the exact owned persona. Use fictional test text with no fan identifiers or private correspondence.
2. Create a private channel draft using the existing owner workflow. Check the selected provider/account binding, channel, audience, content/media, schedule and version. Missing binding or unavailable channel remains unavailable; do not use another persona's connection.
3. Open the exact preview/review. Compare the actual current text/media and target before recording approval. If anything changes, obtain a fresh preview/current-version approval; an old receipt does not approve new bytes, a different account or a different audience.
4. Record approval only as the planning/review result the surface offers. It is **not** a provider send or permission to enable a disabled worker. No live fan message, post, upload or paid generation is part of this guide.
5. If the result is uncertain, preserve its version/receipt and sanitized state. Do not resend automatically, clear an uncertain outcome to retryable or fabricate a successful provider receipt.

Fanvue and Instagram candidates are not installed into production by this procedure. Their proposed approvals, SQL fixtures and mocked transports do not establish real provider, concurrency, model or runtime acceptance. Remote pairing/control remains disabled; there is no general desktop or browser/session control to demonstrate.

## Sign out, shared devices and recovery

Use the offered sign-out control, wait for its result and verify private owner data is no longer available. Where an explicit global sign-out option is offered, distinguish it from local session removal and from external provider revocation. Closing a tab, logging out of MyPersonas or disconnecting one provider are different operations. Do not claim a provider credential is revoked unless that exact supported result is verified.

On a shared/test device, verify a fresh unrelated account cannot see the previous account's persona, draft, source library or cached private view. Do not clear real data to perform this test. Browser/PWA shell caches must exclude owner code/private data. Android **Export local prefs** copies only the configured owner origin, not drafts, fan data, login sessions or a full account backup. Keep existing signed installs and use a separately approved migration; install/store holds remain intact.

For account export/deletion or lost-factor recovery, use the existing documented authorized workflow and retain a verified private copy before any destructive action. This guide does not establish a completed account export, factor-loss exercise or cross-surface restoration. Never turn a raw database dump, browser profile or token store into a marketing/demo backup.

## Operator and cross-account acceptance

Run `npm test` and `node scripts/check-frontend-syntax.mjs` in an isolated checkout; record exact source and results. Do not apply SQL migrations or install the pending PostgreSQL/Deno tooling as a documentation prerequisite. Read the existing [security/access runbook](../MyPersonas.Online_v0/SECURITY-AND-ACCESS-RUNBOOK.md) and [publication governance](../MyPersonas.Online_v0/PUBLICATION-SOCIAL-SECURITY-GOVERNANCE.md).

Before any separately approved runtime release, use disposable fixtures and two authorized test accounts A/B to verify:

- AAL1 private-data denial and AAL2 access; failed/interrupted factor verification stays closed.
- A cannot select/read/edit B's persona, drafts, source/media library or provider connection, including direct identifiers and stale links.
- Sign-out/account replacement clears stale private UI; slow previous-account responses cannot repopulate it.
- Preview approval binds exact current bytes/persona/provider/account/audience/version; edits, revocation and entitlement changes invalidate old eligibility without silently republishing on restoration.
- Public canon, owner-private and fan-private memory remain unimplemented requirements; tests must not claim them by substituting ordinary chat history.
- Disabled send/remote gates remain closed and unknown transport outcomes do not trigger duplicate actions.

These are acceptance criteria, not newly executed real-DB/browser/provider results. Preserve privacy and exact receipts while keeping all migration, credential, account-scope, publication and release approvals separate.

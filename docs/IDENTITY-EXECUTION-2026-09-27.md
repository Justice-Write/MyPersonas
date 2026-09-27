# Identity execution checkpoint — September 27, 2026

Status: implemented, locally tested, and committed on codex/identity-roadmap-20260927. No push, production merge, deployment, migration application, provider action, or phone installation was performed. This is not completion of the entire product roadmap.

## Completed local work

- Reconciled the preserved checkpoint with reviewed main, retaining existing owner work and restoring API 36 owner-app UI updates. The unavailable D:/GIT/MyPersonas.Online path was not treated as a source checkout.
- Owner Android URL policy rejects userinfo, malformed hosts, unsafe schemes, and release loopback imports. Preference imports are bounded and fully read. Mixed content is denied. Package identity remains online.mypersonas.owner.debug.local.
- Owned secondary persona co-managers can generate drafts through explicit account_persona_links. Owner, assignment, suspension and provider checks run before the provider call and again before saving; revocation prevents a draft from being retained. Publication remains pending and not queued.
- Recovered deployed source as detailed in SOURCE-RECOVERY-2026-09-27.md, including previously missing research, developer, OpenArt, ElevenLabs and local-fleet support. Recovery is not a new activation or comprehensive provider audit.
- Reconciled the two preserved local migration candidates as 078/079, preserving applied history and testing their behavior in disposable PostgreSQL fixtures. Full ledger reconstruction remains outstanding.
- Added deterministic, inert, private persona review packets with exact content hashes. The current read-only snapshot covers all 27 roster personas; all remain unpublished, with 25 destination-link entries. All review decisions remain pending and publish_authorized=false.
- Pages packaging requires main, tests and the explicit mobile verification marker in addition to existing gates. Supabase deployment requires main, tests, production environment and an bounded named-function release scope. GitHub reviewer configuration was not changed.

## Verification

- Node: 516 passed, zero failed/skipped. Frontend inline-script syntax passed.
- Deno: all 53 local deployable function entrypoints check; seven budget behavior tests pass.
- PostgreSQL 16: backend URL edit 078 apply/reapply; provenance frozen 059→060→079/reapply; persona-view 058 apply/reapply; security-advisor 061 apply/reapply. Fixture schemas are not a production-equivalent replay.
- Owner Android: testDebugUnitTest and assembleDebug pass, including URL-policy regression cases. APK SHA-256 f96089a7d4e161cfba70cd125834e576017c059077c56c2488f6adb32f13ef75. Signing certificate matches the existing installed .local package, pulled read-only.
- AliaSpaces validation and APK details are recorded in its docs/ANDROID-SECURITY-2026-09-27.md. The portfolio installation hold is preserved.

## Private review output

Ignored outputs/identity-readiness-2026-09-27/review/index.html contains the owner-review batch. The snapshot includes public-intent content even though every persona is unpublished; it must remain private. Nineteen profiles have family edges still marked working/unconfirmed, three have missing media alt text, and all 27 reference correlation-prone storage URLs. These findings were not converted into approvals or invented canon. Rebuild with scripts/persona-review-snapshot.sql and scripts/build-persona-review-packets.mjs after an authorized read-only refresh; changed content creates new hashes and needs a fresh review.

## Remaining engineering, distinct from external approvals

1. Reconstruct the 33 applied migration versions missing from local filenames using authenticated statement history, resolve equivalent differently named migrations, and demonstrate a disposable production-equivalent replay. Evidence: docs/evidence/migration-drift-2026-09-27.json. Authentication is available; this is unfinished engineering.
2. Rebase and integrate older opaque-media, approved-media, source-library, billing, custom-field and operations-alert branches individually after schema reconciliation. Their old logical numbers collide with reviewed main. Do not wholesale merge or deploy them.
3. Complete the private-control-plane/social-app separation and the remaining product features in the long-term roadmap. Source recovery alone does not complete those features or verify provider behavior.
4. Review quarantined legacy entrypoints and retire or reconcile their production counterparts through a separately approved release.

## Owner and environment dependencies

- Lift the portfolio installation hold before installing these APKs or performing new-binary device QA. New bridge runtime, file transfer, MFA return and save-preservation checks are not claimed.
- Provide/authorize production-equivalent staging and two unrelated signed-in MFA accounts for cross-owner/privacy acceptance. No new paid infrastructure or account was provisioned.
- Review exact persona copy, family canon, media rights, disclosures, destinations, visibility and time zone against the private packets before any publication or linking.
- Provider consent, business verification, paid entitlements, email adapter credentials/key custody, SMTP/CAPTCHA and hosting settings require their specific owner actions. No permissions or spending were changed.
- Domain/front-door cutover, branch protection/reviewer settings, public release, and store submission remain separate approval steps.

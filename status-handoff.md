# MyPersonas release preflight — 2026-10-29

**Last updated:** 2026-10-30 UTC

## 0. Operating rule — every agent, every time (mandatory)







1. **Before you start any work**, add an entry to §8 *In progress*: UTC time, your model/tool name, what you are about to do, which files/systems you will touch. Save the file before doing the work. If you are interrupted, this entry is the only record of what was half-done.



2. **When you finish (or stop, or get blocked)**, move your entry out of §8 into §9 *Work log* (newest first) with what actually happened: files changed, commits/PRs, deploys, test results, evidence paths, anything left undone. Then update §4 *Current state*, §5 *Next steps* and §6 *Owner decisions* so they are true right now. Update **Last updated** above.



3. **If you find a stale entry in §8** from someone else, do not delete it. Check whether that work landed (git log, file timestamps, deploy logs), then record your finding under it and move it to §9 marked `INTERRUPTED — verified state: …`.



4. Never record secrets, tokens, passwords, or personal data here. Reference where evidence lives instead.



5. Keep entries short and factual. Separate *verified* from *claimed by a source doc*. If you did not run it, say so.



6. Other agents (Codex, Cursor, Claude Code, ChatGPT, Claude Cowork) work in this repo and its worktrees concurrently. Check §8 before starting so you do not collide.



7. Copy this operating rule unchanged into any new handoff you create for another project.







---




## In progress
- **2026-10-30 UTC · Codex project stocktake and roadmap continuation:** reconcile the family workflow review with current `main`, clarify historical receipt hashing, document the project/release/data/install inventory, rerun the complete verification suite, and update PR #29. Scope is this isolated worktree plus read-only GitHub/device/filesystem evidence. No provider sends, production migrations, secrets, owner-media transfer, phone downgrade/uninstall, training, or generation.
## Current state
Integrated release/audit candidate; backend evidence and private canary remain unverified. The live Pages revision is still `acadc5d` from September 24 and the latest recorded backend release `8131264` retains no exact-current artifact. Current source is not current production.

PR28 records a newer installed Android shell than the rebuilt candidate: preserve it; do not downgrade. Read-only device readback confirms MyPersonas code 2 / `0.1.1-debug`, while this repository reproduces only code 1 / `0.1.0-debug`. No MyPersonas/AliaSpaces Windows install or confirmed PWA is evidenced. Separate Personas and Soul Concept applications are installed; their data and release lanes are not MyPersonas package contents.

The family private-handoff/owner-guide review is reconciled with current main in PR29. Its historical receipt now binds all seals to revision `26c712e` and records raw-Git-blob versus CRLF-checkout byte domains. Complete local suite: 556/556 passing; hosted review remains the merge authority.

Noo public-source mirror reconciliation is complete on focused branch `codex/noo-source-sync-20261030`: 30/30 public files are byte-for-byte identical to canonical `Justice-Write/nooyouniverse` main `73035f0`, including the later disclosure/accessibility/cache changes. The deploy helper remains preview-only by default and reported 30 unchanged / 0 differences. Private `outputs/` material was not touched. Merging this source mirror does not deploy either website.

Public-safe project/release/data boundaries are recorded in `docs/PROJECT-STOCKTAKE-20261030.md`. The reusable application, owner-authorized identity/content packs and private runtime state are separate layers. Exact machine/chat/device/data evidence remains in the private stocktake outside source.

## Next steps

1. Read back PR29 hosted CI and independent review; merge only if current-main reconciliation remains clean.
2. Reconcile/close older conflicting PRs by unique change and recorded supersession; do not bulk-close or discard history.
3. Reconcile MyPersonas Android code-2 source and signing identity, then build an equal-or-newer data-preserving upgrade before any install.
4. Confirm the authenticated migration/provider ledger, run the image-caption backend release for the exact intended main revision, retain its artifact, and complete owner sign-in/MFA plus the signed-in private canary.
5. Only then dispatch the manual Pages workflow with the exact backend run ID; verify live hashes, routes and signed-in owner workflows afterward.
6. Continue MyPersonas/AliaSpaces extraction and AliaSpaces native/two-account acceptance in its separate sole-writer lane.
7. Move identity-bearing persona/launch assets toward destination-specific owner-approved content packs; keep private outputs, sessions, media, models, logs and backups outside reusable installers.

## Owner decisions and release gates

- `publishing_enabled` remains false. A draft, approval, merge or deployment does not authorize a provider send.
- Preserve the newer installed MyPersonas package and its sandbox; no downgrade, uninstall, clear-data or signer bypass.
- No production migration, backend/Pages deploy, provider connection change, social publication, training, owner-media move or account change is claimed by this stocktake.
- The historical workspace root is gone. Use the canonical repository through isolated worktrees and preserve the dirty owner checkout.
## Work log
- 2026-10-30 UTC · Codex project stocktake: reconciled PR29 with current main/PR30/PR31/PR32; clarified the historical receipt's exact revision and newline/hash domains; added the public-safe product/release/data inventory and package/content/runtime separation; corrected README's Pages trigger description; retained exact chat/device/data evidence only in private local stocktake. Local full suite 556/556, frontend syntax, package audit and diff checks passed before final push. No production/provider/account/media/training/device mutation.
- 2026-10-30 UTC · Codex GPT-6: corrected the root repository identity to `Justice-Write/MyPersonas`, added a mandatory `status-handoff.md` pointer for all AI models, and added a public-safe `CLAUDE.md` entry point that preserves state/evidence/data boundaries. No product code or external system changed.
- 2026-10-30 UTC · Codex GPT-6: added fail-safe ignore coverage for `.env*`, `.dev.vars*`, Java/PKCS signing stores and PEM/key files while retaining explicit example-file exceptions. Verified every protected sample path resolves to the intended rule and both examples remain allowed; `git diff --check` passed. No tracked file was removed or secret content inspected.
- 2026-10-30 UTC · Codex GPT-6: based a clean worktree on MyPersonas `origin/main` `847aa0d`, integrated reviewed parity commit `aaf212f`, applied only four later canonical Noo public-file changes, and proved exact 30/30 raw-byte parity through `_ops/deploy-nooyouniverse.ps1`. `git diff --check` passed. No MyPersonas/Noo deployment, provider action, migration, private-output edit or device action occurred.
- Worktree created at C:/mp-release29 from origin/main.


## Verification checkpoint 2026-10-29
- Added verify-pages-package.mjs and workflow step; six regressions/full 533 tests pass, frontend syntax and diff-check pass. Public website package: 81 exact source members; ZIP SHA256 3d18c416d742bf98b92728371127ecd9ea2b58d50acd5852a0c63cf63b1ba915. Package itself is outside repo.
- Android offline assembleDebug failed before compilation: java.io.IOException Unable to establish loopback connection. No APK built/installed by this lane. No phone connected.
- Deployment remains gated on current migration evidence, exact-main image-caption artifact and signed-in private canary. Backend run success alone is insufficient. Latest recorded successful Pages run remains September24.
- AliaSpaces/Akasha release belongs to chat 01a1290c-ed8c; project-state PR25, Meta and Soulular lanes preserved. No provider posting, migrations or owner data changes.

- CI found the pre-existing two-high Workroom dependency audit failure. Reused reviewed PR24 commit45d7fa5 on this release branch (Electron44.9.3, undici7.30.1); no duplicate dependency fix invented. Original PR24 retained. Current exact-main backend run38448350086 has zero retained artifacts; Pages remains blocked until fresh exact-revision deployment receipt/canary evidence exists.


- Follow-up: current CI advisory range requires Electron44.10.0. Updated exact Electron pin/lockfile with scripts disabled, preserving reviewed undici resolution. Fresh npm audit --package-lock-only --audit-level=low reports zero vulnerabilities. No desktop binary installed.

## Package inventory and CI startup follow-through

PR26 adds a standalone read-only inventory/parity command and a data-boundary guide at docs/PACKAGE-BOUNDARY-VERIFICATION.md. Its source/package checks supplement the deployment verifier above; media and embedded archives still require separate content/provenance review. Private machine and task inventories stay outside this public checkout.

The creative-library SQL test now waits for the final PostgreSQL TCP listener instead of the image's temporary initialization socket. A mocked lifecycle test reproduces the old failure without Docker; the real hosted SQL check passed at01ea421. Product SQL and production gates were not changed.

Current integration: merged main35c6db9 and subsequent documentation readback88736ee into this branch, retaining its newer Electron/undici lockfile and workflow verifier. Combined local checks pass:537Node tests, frontend syntax and package checks. Final hosted checks are recorded on PR26; no production deployment or device installation is claimed. Older audit-branch dependency pins are superseded by current main.


## Final readback — October 29, 2026

PR27 merged as main35c6db9fd61d9f87b90eff9b0b25bb168bfc815d. All five PR checks passed. Main CI41020175200 initially hit a PostgreSQL startup race before SQL execution; its failed-job rerun passed. Local full suite533passed, no failures/skips; current Workroom lockfile audit zero vulnerabilities.

Android offline packaging SUCCEEDED (34tasks) after setting JAVA_TOOL_OPTIONS to short existing java.io.tmpdir and jdk.net.unixdomain.tmpdir directories. Initial failures are retained in private logs. Candidate APK SHA256a3842919112a733ac25c97fc9c7dd25d4daa79c92c024d2fb43e08712454906b: online.mypersonas.owner.debug.local, versionCode1,0.1.0-debug,targetSDK34. It was NOT installed because the authorized phone already has the SAME package at versionCode2,0.1.1-debug,targetSDK36,lastupdatedSeptember30. Preserve newer installation and data; reconcile its source before an upgrade. No downgrade/uninstall or private-account writes. The installed base APK was read back for program/signature verification, without reading app sandbox/user records.

Remaining: current exact-main backend artifact/private canary for production Pages and signed-in acceptance; canonical source reconciliation for the newer installed owner shell. Public website ZIP remains81exact-source files, private/local, not deployed. AliaSpaces/Akasha remains in its separate active release chat; Soulular/personal/model/media stores unchanged.

## Public-safe source projection — 2026-10-30
Recovered existing family transfer and owner-private-draft guide source into a current-main review branch. Original historical commits are not parents of this branch; private original documentation/receipt retained outside source. Public docs replace personal machine/evidence paths with placeholders. Fixed one roadmap context conflict by preserving both the current release notice and historical guide note. Final555Node tests pass with0failures/skips, frontend syntax and diff checks pass. No SQL/deployment/provider/runtime/owner-data/phone changes. This source review does not claim live family transfer or two-account acceptance. Source originally39e897a/e79f85f and26c712e; published projection has redacted metadata.

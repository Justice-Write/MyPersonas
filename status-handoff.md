# MyPersonas release preflight — 2026-10-29

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
- Release increment complete locally; committing/pushing review branch.
## Current state
Clean main-derived release candidate; backend evidence and private canary not yet verified; no connected phone.
## Work log
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

Current integration: merged main35c6db9 into this branch, retaining its newer Electron/undici lockfile and workflow verifier. Combined checks are being verified; no production deployment or device installation is claimed. Older audit-branch dependency pins are superseded by current main.

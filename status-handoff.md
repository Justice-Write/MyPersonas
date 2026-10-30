# Personas release and data documentation handoff

Client date: 2026-10-29. Package-audit tooling and documentation isolated branch based on origin/main 8131264. Canonical shared handoff remains in the MyPersonas checkout; do not copy its private machine/account history into this public repository.

## 0. Operating rule — every agent, every time (mandatory)







1. **Before you start any work**, add an entry to §8 *In progress*: UTC time, your model/tool name, what you are about to do, which files/systems you will touch. Save the file before doing the work. If you are interrupted, this entry is the only record of what was half-done.



2. **When you finish (or stop, or get blocked)**, move your entry out of §8 into §9 *Work log* (newest first) with what actually happened: files changed, commits/PRs, deploys, test results, evidence paths, anything left undone. Then update §4 *Current state*, §5 *Next steps* and §6 *Owner decisions* so they are true right now. Update **Last updated** above.



3. **If you find a stale entry in §8** from someone else, do not delete it. Check whether that work landed (git log, file timestamps, deploy logs), then record your finding under it and move it to §9 marked `INTERRUPTED — verified state: …`.



4. Never record secrets, tokens, passwords, or personal data here. Reference where evidence lives instead.



5. Keep entries short and factual. Separate *verified* from *claimed by a source doc*. If you did not run it, say so.



6. Other agents (Codex, Cursor, Claude Code, ChatGPT, Claude Cowork) work in this repo and its worktrees concurrently. Check §8 before starting so you do not collide.



7. Copy this operating rule unchanged into any new handoff you create for another project.







---








## Current state
Read-only public-package auditor and data-boundary verification guide added. All 530 Node tests and frontend syntax pass. The main-source local artifact has 81 files / 83,955,756 bytes with exact byte parity. Audit implementation is published on PR26. Existing PR24 dependency remediation is incorporated unchanged as 118b5a1 after the inherited audit failure. All 530 local tests still pass; final hosted checks are tracked on the PR. Production deployment and installation are not claimed.

## In progress
- None.

## Verification
Check Git diff, documentation links and absence of personal paths/data. No runtime changes planned.

## Blockers
Phone disconnected. Website signed-in canary remains unverified. Other source lanes retain ownership.

## Next steps
Run the auditor on release artifacts, complete bundled media/archive review, and retain existing exact-main backend/canary gates. Connected-device acceptance remains separate. See docs/PACKAGE-BOUNDARY-VERIFICATION.md.

## Work log
- 2026-10-29 Codex: incorporated exact dependency fix45d7fa5 from existing PR24 as118b5a1, preserving attribution and validation notes; no new dependency resolution or local installation. Full530tests and Workroom syntax pass. Earlier database-isolation CI failed during PostgreSQL startup and passed on one retry; no SQL gate was suppressed. Final hosted CI follows on PR26.

- 2026-10-29 Codex: added read-only inventory/parity tool, three regression tests covering deny-default rules, private-store/key/model exclusion, and extra/missing/changed artifact bytes, plus package-boundary documentation. Full suite 530/530, zero skips/failures; frontend syntax and local 81-file parity passed. No application runtime, release workflow, production data or installation changes.

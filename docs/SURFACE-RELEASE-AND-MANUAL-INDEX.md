# MyPersonas: surface release and manual index

Version 2026-10-24. Documentation baseline: remote `main`, **813126414fa7554e78f38f6944014b011f5c84cc**. A branch, passing test, planning approval, deployed source and live acceptance are different states. This index neither integrates candidates nor activates any feature.

## Product and surface map

| Surface | Exact evidence | State and manual boundary |
|---|---|---|
| MyPersonas owner web | `main` at `813126414fa7554e78f38f6944014b011f5c84cc`; production deployment `7194120866`, successful 2026-10-20 | Current deployed source. Private owner control plane; use [owner/operator guide](OWNER-USER-AND-ACCEPTANCE-GUIDE.md). Live backend/provider parity is not established solely by the deployment. |
| AliaSpaces | Separate product/repository under [PROJECT-BOUNDARY.md](../PROJECT-BOUNDARY.md) | Public first-party social presentation; shared v0 files do not transfer product ownership. No AliaSpaces candidate is merged by this index. |
| Android owner shell | `apps/personas-android/` in the same main source | Thin debug WebView over `#/owner`; online owner workflow, disconnected limitations, local-origin preferences export only. Not a standalone publisher, offline draft backup, Play release or new install authorization. |
| iOS owner source | `apps/personas-ios/` in main | Source/scaffold; native build, device, accessibility and store acceptance remain separate. |
| Workroom desktop boundary | `apps/workroom-bridge/` in main | Per-account partition/source scaffold. Its owner-PWA launch button remains disabled until a separately approved packaged release. Provider credentials stay in the visible provider session, not in protocol URLs. |
| Personas desktop lounge | Separate `Justice-Write/Personas` main at `73879e402ecd85cb5742fd50749cc4ce3a6bee7d` | Older desktop source. Its release/manual index distinguishes main from newer local hardening; do not claim encrypted storage or system-browser OAuth for this older source. |
| Soulular creative desktop | Separate ownership/release lane | Installed/source state is maintained by its active release task. No installed workspace, training, assets or installer is touched here. |
| Content-report review | [PR #22](https://github.com/Justice-Write/MyPersonas/pull/22), `claude/content-reports-20261016`, remote head `6591d210f327d11e4bd9e862b150dcdcfcabe750` | Open/mergeable, recorded CI successes; not production. A local worktree has a different later head, so do not equate its files with the PR. |
| UI/Reddit helper candidate | [PR #20](https://github.com/Justice-Write/MyPersonas/pull/20), `0af1ef31182b508dfa950fb3d88231433333e6b4` | Open candidate; no provider publication inferred. |
| Mobile candidates | [PR #15](https://github.com/Justice-Write/MyPersonas/pull/15), `d888a9c90b7c783a819ea663a614b88ac4a38c3e`; draft [PR #14](https://github.com/Justice-Write/MyPersonas/pull/14), `98ab266a360181dcf51c02a2b8ed986dfb1662f4` | Separate source/packaging/checklist candidates. No phone installation, offline workflow or store acceptance inferred. |
| Fanvue | Local `codex/fanvue-connector-20261021`, `da42f44cf1ce5f8050cbd9ad070833e20e93644a` | Source review candidate, clean at readback; exact branch absent from actual GitHub refs and no matching open PR found. Not connected/deployed/live-validated. Connection/persistent-access switches off; planning approval is not send authority. |
| Instagram | Local `codex/instagram-messaging-20261022`, `5bc8281b1115e92d6bb4662022558d66f7a15831` | Clean local candidate; exact branch absent from GitHub refs and no matching open PR found. Reviewed/exact-catalog/conversational modes remain disabled/unapproved; no real messages, model or provider acceptance claimed. Isolated PostgreSQL/Deno tooling approvals remain pending. |
| Remote account prototype | Local `codex/soulular-remote-account-20261021`, `5fdcc53a2f1b9c2bb9c9149bd82154265f00d8e0` | Disabled/unconnected. Account pairing/control UI is not configured; only proposed `status.get`/`jobs.list`, no generation/cancel/general desktop control. Exact branch absent from GitHub refs. |
| Remote rollout candidate | Local `codex/soulular-remote-rollout-20261021`, `a567734ca7fd504df44c7d394be48a078ee34dde` | Separate unapplied rollout/review source; exact branch absent from GitHub refs. Not authorization to provision infrastructure, keys or permissions. |
| Outbound relay component | Local `codex/soulular-outbound-relay-20261021`, `0d0c8171902f633faaea0915774e47c061d81137` | Separate local repository, no origin remote. In-memory transport tests are not Cloudflare/native/database/runtime acceptance. Remote remains disabled. |

Open PR #8 is a separate draft brand-host cleanup; this index does not make its wording production truth. PR lists are point-in-time, not permanent release status. No exact graph ahead/behind count is inferred from a missing branch ref.

## Memory requirement: specified, not implemented

The required future separation is (1) approved public persona canon, (2) owner–persona private memory, and (3) fan–persona private memory scoped to that exact fan/account relationship. Approval, access, retention/export/deletion and cross-account isolation must be established for each boundary. Existing persona fields, source libraries, chat rows or desktop history are **not proof this three-way memory contract exists**. No cross-fan reuse, training or automatic promotion of private memories to public canon is permitted by this documentation.

## Release gates and validation

Provider credentials remain server-side under exact owner/persona/provider/account binding; values never belong in examples, exports or screenshots. `publishing_enabled` remains false in the mobile/private-planning contract. A planning approval is not a provider send. The social and remote candidates above remain inactive.

Pages/backend releases are manual and gated by the existing workflows, including exact-main backend/canary evidence and typed confirmations. This index does not supply those approvals or bypass them. No migrations, Deno/database tooling installation, auth scope, real fan data, social send, provider connection, pairing or deployment was performed.

Baseline validation in this documentation pass: **527 Node tests pass** and frontend syntax check passes. Local SQL/Deno/real-provider/device acceptance was not run; prior PR CI is separately labeled evidence. Guides live under root `docs/`, outside the Pages `MyPersonas.Online_v0` output and desktop/mobile runtime assets.

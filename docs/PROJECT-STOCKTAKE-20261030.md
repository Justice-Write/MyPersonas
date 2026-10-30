# Project stocktake and continuation — October 30, 2026

This is a public-safe coordination record for MyPersonas. It distinguishes source,
CI, packages, deployments, installations and signed-in acceptance. It contains no
credentials, private chat identifiers, device identifiers or owner-media paths.

## Product and repository map

| Product or project | Relationship to MyPersonas | Boundary |
|---|---|---|
| MyPersonas | Canonical private owner/control plane | Owns provider connections, private drafts and approvals, automation, entitlements, audit and the current production-migration authority. |
| AliaSpaces | Separate first-party social product | Owns public persona presentation, discovery, feeds and social interaction. Shared contracts must remain narrow, versioned and owner-scoped. |
| Personas | Companion desktop/mobile work | A separate application lineage. Preserve its state and migrate through explicit readers; do not treat it as the MyPersonas web package. |
| Soulular / Soul Concept | Private creative and reference-media system | Models, reference libraries, training controls, generated media and creative history remain separate from MyPersonas packages. |
| Soul Concept Engine | Consent/provenance infrastructure | Related contracts and tooling, but a separate repository and release track. |
| Castleborn / CREATE and persona-brand sites | Consumers of persona/canon/content workflows | Private canon and brand workspaces are data, not generic installer members. Each site keeps its own deploy authority. |
| Noo YouNiverse | Independently deployed brand site with a reviewed source mirror here | The canonical site repository remains its build/deploy authority. Mirroring source into MyPersonas is not a deployment. |

The current MyPersonas v0 tree is transitional and still contains historical
AliaSpaces/social UI. Source location does not change permanent product ownership;
see [PROJECT-BOUNDARY.md](../PROJECT-BOUNDARY.md).

## Chat and workspace reconciliation

The project history spans the dedicated MyPersonas project, a related AliaSpaces
project, the Soul Concept Engine project and recovered persona/site chats. Some
current and recovered chats still point at a removed historical workspace root.
Those chats are useful evidence, but their stale working directory or missing
project membership is not proof that their changes landed. Exact chat identifiers
and private transcripts remain in the private audit record, not this repository.

The canonical owner checkout is dirty and intentionally preserved. Continuation
work uses isolated worktrees from an exact remote revision. Never reset, clean or
pull over the owner checkout to make its status look current.

## Verified release truth at this checkpoint

| Layer | Verified state | What it does not prove |
|---|---|---|
| Remote source | Main is pushed through `a1a4e6e`; merged-main CI run `41051296609` passed all five substantive jobs. The complete current local suite reports 559/559 passing. | A green merged revision is not deployed or accepted on a device. |
| GitHub Pages | `https://mypersonas.online` responds over HTTPS. The last successful Pages deployment is revision `acadc5decd4333b4258e86a91cc76c1836ef523c` from September 24, 2026. | The live site is not current `main`. |
| Backend release | The latest recorded successful backend workflow is revision `813126414fa7554e78f38f6944014b011f5c84cc`; its run retains no exact-main release artifact. | It cannot satisfy the current Pages workflow's exact-revision binding. |
| Pages candidate | The current allowlist selects 82 exact-source members, including the public sites/apps checklist. A fresh private ZIP from `a1a4e6e` has SHA-256 `6712c6f3f2b4ba9add7d45edbbd2c121961caa2bc4c433fc4331e4a528968476`; verifier and byte-parity audit passed with 0 failures. | Filename and byte checks do not certify media consent, archive contents, credentials hidden inside text, deployment or signed-in behavior. |
| MyPersonas Android | The proven version-code-2 / `0.1.1-debug` source inputs are reconciled. A clean build matches the installed/retained package ID, SDK levels, signer certificate and all 15 APK entry payloads. | The rebuilt outer APK container is 736 bytes larger and has a different whole-file hash, so it is not claimed byte-identical. The installed package remains untouched; do not downgrade, uninstall or reinstall merely to prove source provenance. |
| Desktop | No MyPersonas or AliaSpaces Windows installer/PWA installation is evidenced. Personas and Soul Concept are separate installed applications. | Their presence is not a MyPersonas desktop release. |
| Provider publishing | `publishing_enabled` remains false; saved approvals and manual plans are not provider sends. | No social post, queue or schedule is live merely because source or drafts exist. |

The Pages workflow is manual by design. A release needs current migration/provider
ledger evidence, a backend artifact from the exact main revision, owner sign-in/MFA,
the signed-in private image-caption canary and the exact backend run ID. Do not type
confirmation strings from an old run or an assumed ledger.

## Reusable package, optional content and private state

The installation model has three explicit layers:

1. **Reusable application package:** reviewed application code, manifests, schema
   and migration source, licensed dependencies, synthetic fixtures, icons and only
   the public assets required for the shell.
2. **Owner-authorized content pack:** persona definitions, real avatars/banners,
   canon, launch content and other identity-bearing assets that the owner explicitly
   approves for a named destination. A generic install must function without this
   pack.
3. **Private runtime state:** accounts, sessions, cookies, OAuth grants, credentials,
   drafts, approvals, audit receipts, chats, reference photos, generated media,
   exports, models/adapters, logs, caches, backups and device/app sandboxes. This is
   never an installer payload.

The repository contains a large ignored `outputs/` tree used for research, media,
approvals and working evidence. It is not source and must remain excluded. The
tracked persona/avatar/banner and launch assets are identity-bearing content even
when intentionally public; move toward an owner-approved content sidecar instead of
assuming they belong in every reusable build. Installed creative-application roots
also contain large owner reference libraries, so copying an installed directory is
not a valid packaging method.

Secrets, signing inputs, local environment files and production credentials stay
outside repositories and artifacts. A development debug keystore is never a
production signing identity. Negative-test/tampered packages are evidence only and
must never be promoted as release artifacts.

## Roadmap continuation

1. **Completed:** the family handoff/private-draft review is reconciled, all nine
   declared historical receipt hashes reproduce and the complete suite is green.
2. **In progress:** older conflicting pull requests are triaged by unique change.
   PR8, PR15, PR23 and PR25 are closed only after verified supersession. PR20 and
   PR22 retain unique work; PR14 requires a current security/release redesign for
   its feed, push, Expo, SDK and migration proposals. Preserve them for focused
   extraction rather than bulk merge or deletion.
3. **Source provenance completed:** MyPersonas Android version code 2 now has a
   reviewed canonical source baseline. The clean candidate matches its manifest,
   package/version, signer and every APK entry payload; the differing outer container
   hash is recorded. Keep the already-installed code-2 package and its state. Any
   future code-3+ upgrade still needs export/backup, manifest/signer checks and
   launch/sign-in acceptance. Never uninstall to solve a signer or version problem.
4. Confirm the authenticated production migration/provider ledger. Run the backend
   release for the exact intended main revision, retain its artifact and complete
   the signed-in private canary.
5. Dispatch the gated Pages workflow only with those current facts. Read back live
   hashes, routes and signed-in owner workflows after deployment.
6. Continue the MyPersonas/AliaSpaces extraction with one deployment owner per
   function/migration and complete unrelated-account privacy, real-phone MFA and
   native save/restore acceptance in AliaSpaces' own release lane.
7. Externalize owner content and creative libraries from reusable installers; add a
   release manifest with source revision, artifact hash, signer, package/version,
   data path, migration policy and post-update readback.

No provider post, production migration, account change, owner-media move, training
job, downgrade, uninstall or production deployment is authorized by this document.

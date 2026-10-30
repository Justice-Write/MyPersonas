# Project stocktake and continuation — October 30, 2026

This is a public-safe coordination record for MyPersonas. It distinguishes source,
CI, packages, deployments, installations and signed-in acceptance. It contains no
credentials, private chat identifiers, device identifiers or owner-media paths.

## Product and repository map

| Product or project | Relationship to MyPersonas | Boundary |
|---|---|---|
| MyPersonas | Canonical private owner/control plane | Owns provider connections, private drafts and approvals, automation, entitlements, audit and the current production-migration authority. |
| AliaSpaces | Separate first-party social product | Owns public persona presentation, discovery, feeds and social interaction. Shared contracts must remain narrow, versioned and owner-scoped. |
| Persona Studio / Personas | Private desktop/mobile companion tooling | A separate application lineage. Preserve its state and migrate through explicit readers; do not treat it as the MyPersonas web package. |
| Soulular / Soul Concept | Private creative and reference-media tooling | Models, reference libraries, training controls, generated media and creative history remain separate from MyPersonas packages. |
| Soul Concept Engine | Consent/provenance infrastructure | Related contracts and tooling, but a separate repository and release track. |
| Castleborn / CREATE | Consumer of persona/canon/content workflows | Private canon and game workspaces are data, not generic installer members. Its repositories and releases remain independent. |
| Noo YouNiverse, Being Tea Co, PrintMason and persona-brand sites | Consumers of owner-approved persona content | Each site keeps its own source and deploy authority. A MyPersonas mirror, link or draft is not a site deployment. |
| Social-management and creator operations | Downstream planning and staging | Drafts, approvals and destination content packs may be prepared here; provider posting remains separately gated and disabled by default. |

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
| Remote source | Product source is reconciled through `1f0137e` (PR42); merged-main CI run `41068633552` passed all five substantive jobs. This documentation-only successor adds no runtime capability. PR39–PR42 are merged, PR14 is closed as superseded, and PR20/PR22 remain open for their unresolved unique scope. | A green merged revision is not deployed or accepted on a device. |
| GitHub Pages | `https://mypersonas.online` responds over HTTPS. The last successful Pages deployment is revision `acadc5d` in run `35981622035` from September 24, 2026. | The live site is not current `main`. |
| Backend release | The latest recorded successful backend workflow is revision `8131264` in run `38448350086`; the run retains zero release artifacts. | It cannot satisfy the current Pages workflow's exact-revision binding. |
| Pages candidate | The private package rebuilt from exact final main `35ee29c` selects 125 exact-source members / 83,998,450 bytes. Both package verifiers report byte parity with zero failures; its ZIP SHA-256 is `3a9b7fca2f3e5e68361ea4f397dce93088ad714fd1bd9d9878f96df55719085a`. | Forty pre-existing media/archive members still require destination-specific review. Filename and byte checks do not certify media consent, archive contents, credentials hidden inside text, deployment or signed-in behavior. |
| Phone applications | MyPersonas local code 2 and cloud code 1 are installed; the reconciled code-2 source baseline remains the protected upgrade reference. AliaSpaces production and acceptance shells are code 7. Separate Soul Concept and Persona Studio applications are also present. | Presence is not current-main deployment, provider acceptance or authorization to reinstall. Preserve app state and do not downgrade merely to create a new receipt. |
| Windows applications | No MyPersonas or AliaSpaces native Windows install was found. Browser-profile inspection was intentionally excluded, so PWA installation is unconfirmed rather than disproved. Persona Studio and Soul Concept are separate installed applications. | Their presence is not a MyPersonas desktop release, and their private libraries are not installer inputs. |
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

Fresh machine inventory confirms that ignored outputs, owner reference media,
generated media and private application/runtime state are much larger than the
reusable source and runtime binaries. Exact private sizes and locations remain in
the owner-only audit. The repository's ignored `outputs/` tree is used for research,
media, approvals and working evidence; it is not source and must remain excluded.
Tracked persona/avatar/banner and launch assets are identity-bearing content even
when intentionally public, so they should move toward destination-specific,
owner-approved content sidecars instead of being assumed to belong in every build.
Copying an installed creative-application directory is never a valid packaging
method because those roots also contain private libraries and runtime state.

Secrets, signing inputs, local environment files and production credentials stay
outside repositories and artifacts. A development debug keystore is never a
production signing identity. Negative-test/tampered packages are evidence only and
must never be promoted as release artifacts.

## Roadmap continuation

1. **Current-main stocktake completed through PR42:** PR39 records the safe PR14
   security/release redesign and PR14 is closed; PR40 carries the bounded PR20 glyph
   bank; PR41 records the PR22 moderation security design; and PR42 carries the
   hardened nine-call owner-dialog slice. Exact-main CI is green. None of those
   source merges is a deployment, provider send or device acceptance receipt.
2. **Preserve unresolved pull requests:** PR20 remains open for the remaining modal
   conversions and a separately hardened Reddit contract; do not import its
   permissive UUID, scope or expiry fallbacks. PR22 remains open until the owner
   resolves authority/recusal, reporter privacy, immutable evidence/events,
   retention/legal hold, transitions, duplicate handling and cross-product
   authority. Migration 080 is unapplied and no live moderation capability exists.
3. **Source provenance completed:** MyPersonas Android version code 2 has a
   reviewed canonical source baseline. The clean candidate matches its manifest,
   package/version, signer and every APK entry payload; the differing outer container
   hash is recorded. Keep the already-installed code-2 package and its state. Any
   future code-3+ upgrade still needs export/backup, manifest/signer checks and
   launch/sign-in acceptance. Never uninstall to solve a signer or version problem.
4. **Package closeout completed for `35ee29c`:** the final-main private artifact has
   125 exact-source members and zero parity failures. Retain earlier packages only
   as superseded evidence and review the 40 flagged media/archive members before
   any destination decision. Package parity still does not authorize a deployment.
5. Confirm the authenticated production migration/provider ledger. Run the backend
   release for the exact intended main revision, retain its artifact and complete
   the signed-in private canary.
6. Dispatch the gated Pages workflow only with those current facts. Read back live
   hashes, routes and signed-in owner workflows after deployment.
7. Continue the MyPersonas/AliaSpaces extraction with one deployment owner per
   function/migration and complete unrelated-account privacy, real-phone MFA and
   native save/restore acceptance in AliaSpaces' own release lane.
8. Externalize owner content and creative libraries from reusable installers; add a
   release manifest with source revision, artifact hash, signer, package/version,
   data path, migration policy and post-update readback.

No provider post, production migration, account change, owner-media move, training
job, downgrade, uninstall or production deployment is authorized by this document.

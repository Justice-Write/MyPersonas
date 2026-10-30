# MyPersonas root handoff

Last reconciled: 2026-10-29 (Alaska)

## Start here

This repository is the canonical MyPersonas owner-control platform. Read this file, then `AGENTS.md`, `PROJECT-BOUNDARY.md`, and `MyPersonas.Online_v0/ROADMAP.md` before changing source or release state.

The public web surface is `https://mypersonas.online`. AliaSpaces is a separate first-party social product even though transitional AliaSpaces source remains in this repository. Persona brand sites and apps are associated products, not automatically part of this deployable.

## Current verified state

- Default branch: `main` at `813126414fa7554e78f38f6944014b011f5c84cc` when this handoff was written.
- GitHub repository: public `Justice-Write/MyPersonas`.
- Release rule: Pages deployment is manual and requires all four evidence inputs in `.github/workflows/pages.yml`. Do not bypass them.
- Publishing remains disabled. A draft approval is not a provider send.
- Android is a debug-only WebView companion. It is not a Play build and contains no OAuth secret or provider-posting code.
- iOS contains source scaffolding only; no signed iOS package is produced on Windows.
- No phone was connected during this reconciliation, so no fresh device installation is claimed.
- The repository contains no committed `.env`, private key, or literal named API-key assignment found by the bounded source scan. OAuth token field names exist in server code and schema because tokens are runtime data, not bundled values.

## Associated project map

### Core platform projects

| Project | Role | Relationship |
| --- | --- | --- |
| MyPersonas | Private owner control plane, drafts, approvals, account ledger, provider gates | This repository |
| AliaSpaces | First-party social network and public persona product | Separate product; transitional source remains here |
| Personas | Desktop persona/soul host application | Separate repository and installer lifecycle |
| Soulular / Soul Concept | Local persona media, models, collections, and creative workflows | Separate repository and private data lifecycle |
| Castleborn / CREATE | Character canon and private character-development layer | Source of character constraints, not part of the public install package |

### Persona and brand projects

The account inventory and related tasks identify these operational persona projects: Christian Cody, Chris Cody, Justice Right/Castleborn, WAIS, Always Cooked Just Right, Unjustice Right, DND Mommy, Sophia's Imagination, Just Right Communication, Noo YouNiverse, Print Mason, Fix My Frozen PC, Contractors Club, Being Tea Co., Life Giving Compassion, Aware of My Food, Smile to Your Body, Compassion Seed/Terraseeds, Girl Gamers, Retriever Energy, Traditional Family Values, Jokes from Dads, Oversharing Mom, Sherlock Chomes, Cannacandids, Cannacandidz, Classwoods, Collective Supply, and Spark & Sage.

Each brand can have its own website, app, domain, content library, legal/compliance requirements, and release gate. A handle or a website record does not prove ownership, current deployment, or permission to publish.

## Roadmap continuation order

1. Keep production release truth exact. Reconcile source, migrations, backend run, Pages SHA, signed-in canary, and public readback before a deployment claim.
2. Finish the owner command-center milestone: owned persona selection, private four-channel draft creation, and exact-preview approval.
3. Complete unrelated-account privacy and signed-in real-device acceptance.
4. Reconcile the active feature branches into small reviewed pull requests. Do not combine billing, provider publishing, creative library, mobile, and local-model work into one merge.
5. Publish persona pages only after owner review of the exact revision. Keep external provider publication as a separate gate.
6. Keep install packages code-only. Export/import owner content through explicit, versioned, encrypted or access-controlled data paths.

## Release gates

Before a Pages deployment, verify the exact current `main` revision and provide:

- `MIGRATIONS-VERIFIED`
- `PROVIDER-MIGRATIONS-VERIFIED`
- `IMAGE-CAPTION-CANARY-VERIFIED`
- the successful image-caption backend workflow run ID for that exact commit

Before an Android device claim, record the APK hash, package ID, signing certificate, connected-device serial, install result, launch result, and owner-route acceptance. The debug package must not be submitted to Play.

## Data boundary

See `docs/INSTALL-PACKAGE-DATA-BOUNDARY.md`. In short: application code, public static assets, schemas, migrations, and empty templates belong in packages. Credentials, OAuth grants, private drafts, account ledgers, messages, analytics tied to people, private character/canon material, owner media libraries, training data, generated private assets, device identifiers, logs with personal content, and backups do not.

## What not to infer

- A public website does not prove its backend, forms, or provider integrations are current.
- A successful build does not prove installation.
- A connected account record does not prove ownership or write permission.
- An approved draft does not mean scheduled or published.
- A branch pushed to GitHub is not merged, deployed, or released.
- A personal-data export is not an install package.

## Next model checklist

1. Fetch `origin/main` and read open pull requests and active worktrees.
2. Check for another active writer before editing shared files.
3. Run the focused tests for the owned lane.
4. Update the relevant roadmap and changelog in the same commit.
5. Push a named branch and open a reviewable pull request.
6. Record deployment, package, install, and public-readback evidence separately.


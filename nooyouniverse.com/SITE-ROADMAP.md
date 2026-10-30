# nooyouniverse.com — canonical site roadmap

Last reconciled: 2026-10-23 Alaska / 2026-10-24 UTC

Owner: Christian · Persona: Cillian O'Sullivan / Noo YouNiverse

This directory is the canonical public-site source. The separate
`Justice-Write/nooyouniverse` repository is the deployment and mobile repository;
only its `public/` directory is served by the Cloudflare Worker. Local, committed,
pushed, deployed, and verified-live are separate states and must be reported as
such.

## Current verified state

| Area | State |
|---|---|
| Live site | `https://nooyouniverse.com` serves the static Cloudflare Worker site. The apex and `www` both respond, but no host-level redirect was verified. |
| Public tree | 30 publishable files: 12 required root files and 18 assets. This local source-parity branch matches the deploy checkout byte-for-byte; the branch is not pushed or deployed. |
| Mission Log | Missions 01–11 are live. Mission 11, “Sleep before stack,” was added in September 2026. |
| PWA | Manifest, network-first service worker, offline page, four PWA icons and shortcuts are live. |
| Support pages | `/sources` and `/corrections` are live. Unknown routes use the custom 404. |
| Headers | CSP, `nosniff`, frame denial, a restrictive referrer policy and permissions policy were verified live on 2026-10-23. HSTS was not present. |
| Held content | `/education` and Missions 12–15 are absent from the public tree and live site. |
| Waitlist | Supabase insert-only contract remains the intended design. Read-only reconciliation on 2026-10-23 found one row, not the named old deploy-test row and not a `verify-%@example.com` row. Preserve the unknown row unless the owner identifies it. |
| Social/profile | Social destinations remain text-only and unverified. No public-posting authority is implied. |
| App | A private Android observation-log/check-hub source tree exists in the deploy repository. It is not a public store release and is not evidence that the product described by Mission 09 exists. |

The deploy repository's remote `main` was `4bfc6d0` at the 2026-10-23 live
reconciliation. The canonical MyPersonas remote `main` was `8131264` and still
contained the older ten-mission, pre-PWA source. This focused local branch closes
that source drift but does not change either remote or production.

## Binding publication rules

- Cillian is a fictional, AI-assisted Castleborn character. Never claim that he
  used, tested, experienced or endorsed a real product.
- Keep the exact public evidence labels: **Strong, Promising, Preliminary,
  Mechanistic, Traditional**. Do not silently rename or inflate them.
- Never publish dosing, stacking, cycling, washout, treatment, diagnosis or
  individualized medical advice.
- Mission 09 and the waitlist describe an unbuilt product. Do not imply app-store
  availability, validated measurements, clinical use or FDA status.
- Preserve the Sources and Corrections paths and distinguish Verified, Reported,
  Inferred and Unknown statements.
- Every content item needs an owner decision and a recorded source/editorial
  review. Ingredient-, dose-, interaction-, condition- or health-benefit-specific
  material additionally requires an accountable qualified health reviewer.
- A generated image, draft, candidate, test result or model output is not an
  approval record.

## Immediate roadmap

### P0 — preserve public truth and release safety

1. Land this focused source-parity change only after review. Do not merge the
   dirty owner checkout wholesale.
2. Decide whether Mission 11 should be kept, revised or retired. It duplicates
   Mission 04's hero image byte-for-byte and substantially overlaps its theme.
3. Locate or create a real reviewer receipt for Mission 11. The public copy says
   “human-reviewed,” but the repositories do not currently supply independently
   verifiable reviewer provenance for that mission.
4. Keep the older signed Android 0.2.1 artifact quarantined: its release identity
   was defective. Use only a newly signed, independently checked candidate after
   fresh owner authorization; do not install or distribute during the hold.
5. Preserve the single unknown waitlist row. The former “delete 2–3 test rows”
   instruction is stale after the 2026-10-23 aggregate readback.

### P1 — editorial package

The former Package A sequence is now proposed as Missions 12–15:

| Proposed mission | Minimum gate |
|---|---|
| 12 — The P-Value Is Not the Payload | owner, source and editorial review; health review if the final copy makes a health claim |
| 13 — The Claim Is the Whole Constellation | owner, source and editorial review; legal review if applied to a named commercial claim |
| 14 — Read the Flight Plan Before the Landing | owner, source and editorial review; preserve methodology-only scope unless additional review is recorded |
| 15 — Tracker Build Diary: A Field Is Not Yet a Measurement | owner, source, editorial, product, privacy, legal, health-safety, technical and accessibility review |

Copy drafts and art candidates are private review inputs. Zero Missions 12–15 are
approved for publication, zero belong in this directory, and zero are live. Until
the owner classifies each final claim and names the required reviewers, keeping all
four held is the safe default.

The `codex/noo-education-app-20261001` branch remains a held, do-not-merge branch.
Its ingredient-specific health-evidence material does not bypass the same review
gate by carrying a “not medically reviewed” label.

### P2 — operations and product gates

- Choose whether HTTP should redirect to HTTPS and whether `www` should redirect
  to the apex. Also decide whether to add HSTS after checking every required
  subdomain and rollback implication.
- Optionally add a real `/favicon.ico`; the linked SVG and manifest icons work,
  while the conventional ICO route returned 404 on 2026-10-23.
- Revalidate the Cloudflare Git hook. It has been unreliable, so a successful push
  is not evidence of a build or deployment.
- Finish newsletter operator, consent, sender identity, unsubscribe, postal
  address, DNS and provider decisions before any email is sent.
- Keep community reporting, private health logs, questionnaire intake, FHIR,
  analytics, commerce and revenue work behind their product/privacy/security/
  legal/health/accessibility gates. Documentation is not a shipped capability.
- Verify ownership and write access before linking or posting to any social
  account. Do not publish the MyPersonas profile merely because local copy exists.

## Deployment architecture

The production host is a Cloudflare **Worker with static assets**, not Cloudflare
Pages.

- Deploy repo: `Justice-Write/nooyouniverse`
- Published directory: `public/`
- Worker config: `wrangler.jsonc`
- Not-found behavior: `404-page`
- Canonical source: this `nooyouniverse.com/` directory
- Source-only document: `SITE-ROADMAP.md` (never copy it into `public/`)
- GitHub Pages fallback marker: `CNAME`

The required public root files are:

`index.html`, `log.html`, `sources.html`, `corrections.html`, `404.html`,
`robots.txt`, `sitemap.xml`, `CNAME`, `_headers`, `manifest.webmanifest`,
`sw.js`, and `offline.html`, plus every file below `assets/`.

`education.html`, Mission 12–15 files, private compendium records and Android
artifacts are not part of the public source set.

## Preview and release procedure

`_ops/deploy-nooyouniverse.ps1` is preview-first. The default mode performs an
exact hash-and-path comparison, including added, changed and deploy-only files.
It does not copy, delete, stage, commit, push or deploy.

Example read-only preview from a worktree:

```powershell
& .\_ops\deploy-nooyouniverse.ps1 `
  -DryRun `
  -SourceDirectory .\nooyouniverse.com `
  -DeployRepository "$HOME\Documents\GitHub\nooyouniverse"
```

An authorized publish run additionally requires:

- reviewed `main` checkouts at their upstream tips;
- the exact pre-release commit hash for both repositories;
- no unrelated working-tree changes;
- an explicit commit message; and
- `-Publish`.

The helper prepares and commits the canonical source before pushing the deploy
repository. It refuses branch/ref drift and stages only the scoped source/helper
and `public/` paths. It no longer sweeps or deletes arbitrary Git lock files. It
may remove a deploy-only file *inside the verified `public/` root* so that public
output cannot retain stale content; review every previewed `DELETE` first.

After a separately authorized push:

1. Confirm the exact Cloudflare build and deployment in the provider dashboard or
   with an authenticated deployment readback. Do not assume the Git hook fired.
2. Read back `/`, `/log`, `/sources`, `/corrections`, `/manifest.webmanifest`,
   `/sw.js`, `/offline.html`, `robots.txt`, `sitemap.xml`, the custom 404 and the
   expected security headers.
3. Confirm `/education` and `/.deploy-poke` remain 404 unless a separately reviewed
   release explicitly changes that.
4. Confirm Mission 12–15 strings/assets did not leak.
5. If `public/` changed, rebuild the Android offline assets and rerun the mobile
   unit, browser-smoke, asset-parity, lint and APK inspection gates before signing.

## Known public issues and decisions

- **Mission 11 visual duplication:** `assets/log/11-sleep-before-stack.jpg` is
  byte-identical to Mission 04's image. Do not silently replace it without owner
  content approval and provenance review.
- **Mission 11 approval provenance:** public “human-reviewed” language currently
  lacks a repository receipt identifying the reviewer and scope.
- **Transport canonicalization:** HTTP and `www` respond instead of redirecting;
  HSTS is absent. These are host-level decisions, not static-copy edits.
- **Conventional favicon:** `/favicon.ico` is absent; the actual linked SVG and PWA
  icons are present.
- **Git hook:** historically unreliable; manual/exact deployment verification is
  required after every public push.

## Historical checkpoints

- **2026-10-23:** live site and deploy `origin/main` reconciled byte-for-byte;
  Mission 01–11/PWA/support pages/security headers present; held routes absent.
  Canonical source drift identified and repaired on an isolated local branch.
- **2026-10-16:** private Android and Missions 12–15 artifacts reconciled; no public
  release. Mission 11 visual duplication recorded.
- **2026-09-26:** PWA, CSP/hardening headers and offline support deployed and read
  back live. Cloudflare Analytics was explicitly allowlisted by CSP.
- **2026-09-18:** Mission 11 appeared live.
- **2026-08-26:** Phase 3 Sources, Corrections and source-basis badges deployed and
  independently verified.

Historical approvals apply only to their exact recorded scope. They do not grant
standing authority for a future mission, app release, database change, email,
social post, profile publication or deployment.

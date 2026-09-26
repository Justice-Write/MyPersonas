# nooyouniverse.com — Site Roadmap

Updated: 2026-09-26 (PWA + headers live; APK 0.2.0; parity restored) · Previous: 2026-09-24 (reconciled against live site) · Owner: Christian · Persona: Cillian O'Sullivan / Noo YouNiverse
Previous update: 2026-08-26 (Phase 3 deployment record)

Stack: static site → **Cloudflare Worker with static assets** + Supabase free-tier email waitlist. This is not Cloudflare Pages. GitHub Pages remains a fallback (CNAME file included). Recorded infrastructure cost: $0/month; billing was not re-audited in this session.

## Status — 🟢 LIVE at https://nooyouniverse.com (Phase 3 verified 2026-08-26)

| Item | State |
|---|---|
| Landing page | ✅ Live |
| Mission Log (`/log`) | ✅ Live — **11 entries** as of 2026-09-24 (the 10 CIL-LW01 launch concepts + "Sleep before stack") |
| 404 page, robots, sitemap | ✅ Live |
| Waitlist table + RLS (migration 027) | ✅ Run in Supabase |
| Waitlist end-to-end | ✅ Previously verified: insert 201 · duplicate 409 · bad email 400 · anon read 401 (denied); not rerun for Phase 3 |
| Deploy repo `castleism/nooyouniverse` | ✅ At `12ca11f` (favicon). Phase 3 was `e8971ad`. ⚠️ Pushes do **not** auto-build — see §September reconciliation ¶2 |
| Cloudflare Worker + apex domain | ✅ HTTPS live; Phase 3 Worker version 4 serves 20 public files |
| `www.nooyouniverse.com` | ✅ Resolves; pages declare apex canonicals; a host-level redirect is not configured |
| **Phase 3** — source badges, `/sources`, `/corrections` | ✅ **Verified live — 2026-08-26** |
| **Package A** — the four drafted Missions 11–14 (P-Value / Claim Constellation / Flight Plan / Tracker Build Diary) | 📝 Still **zero approved; not in site source; not deployed** — none of these four has shipped |
| **Mission 11 "Sleep before stack"** | ⚠️ **LIVE since ~2026-09-18** — a *different* entry from the Package A drafts. See §September reconciliation |
| Branded favicon, PWA icons | ✅ Live (`12ca11f`) |

### Outstanding — operations and owner-only follow-up

Ordered by consequence. Items 1–3 are the ones that actually block things.

1. **Name a human health-claim approver** (pharmacist minimum; psychiatrist too if the app proceeds). This is the master blocker and has been open since August. It gates the evidence library, app Phase 2, every compendium monograph, and all ingredient-specific content. Nothing downstream moves without it.
2. **Repair the Cloudflare Git build hook** — now confirmed failing twice (2026-08-26 manual invocation, 2026-09-18 `.deploy-poke` commit). Diagnosis and check order in §September reconciliation ¶2. Requires a signed-in Cloudflare session.
3. **Rule on Mission 11** — expand it to standard and frame it against Mission 04, or retire it and use the documented Package A gate. See §September reconciliation ¶1.
4. **Verify, then delete, 2 recorded test rows** in Supabase → Table Editor → `noo_waitlist`: `deploy-test-2026-08-09@nooyouniverse.com` and one `verify-…@example.com`. Presence not rechecked since August; confirm exact rows before deleting.
5. **Resolve the under-21 tier conflict** — the tier engine permits private logging for an under-21 Red account while the questionnaire spec stops under-21 users before the health profile. Flagged by ChatGPT, unresolved. Blocks app implementation authorization.
6. **Sync `MyPersonas`** — 13 commits behind, blocked by local uncommitted edits. Owner's call.
7. **Optional domain cleanup:** decide whether `www` should redirect to the apex at the host level. It currently serves and declares the apex canonical, but does not redirect the browser.
8. **Remove the stray `SITE-ROADMAP.md`** from the deploy-repo root, and the four pointer stubs in `outputs/` once nothing links to them.

## 2026-09-26 — shipped

- Deploy repo `main` = `4bfc6d0`. Cloudflare Git build succeeded and is the active version (2917eaa8). Live readback passed: `/manifest.webmanifest` 200 (5 icons, 3 shortcuts), `/sw.js` active, `/offline.html` 200, `/.deploy-poke` 404, `_headers` CSP/nosniff/frame-deny on every response (CSP then widened for Cloudflare Web Analytics).
- This folder is again byte-identical to `nooyouniverse/public/` (added `_headers`, Mission 11 image).
- Private Android app: release-signed `noo-observation-log-0.2.0-release.apk` (`com.nooyouniverse.observationlog`, studio key in `_ops/keystores/`), built Gradle-free; install note + QR in the Drive folder. Owner tap still required.
- New in deploy repo: `deploy/docker/` mirror, `docs/DESKTOP.md`, `docs/CLAUDE-DESIGN-BRIEF-missions-12-15.md` (Package A renumbered 12–15 behind live M11).
- Still owner-only: name the health/science approver (master blocker); Package A approvals; delete the 2 `noo_waitlist` test rows (dashboard sign-in needed); verify social destinations.

## Phase 3 (built 2026-08-09; deployed and verified 2026-08-26)

- **Source-basis badges** on all ten Mission Log entries. They label *what kind of support an entry rests on* — Health-agency source / Methodology reference / Regulatory guidance / Editorial promise · no efficacy claim / Introduction · no factual claim. Classifications taken verbatim from `SOURCE-AND-POLICY-LEDGER.md`; deliberately **not** framed as evidence tiers, because most entries teach method rather than assert empirical claims. Inventing a tier for a non-claim would be exactly the certainty theater the charter forbids.
- **`/sources`** — badge legend, per-mission source table with live links to NCCIH/AHRQ/NHLBI/FDA/FTC, the publication standard, and the hard-limits list ("what this project will never do").
- **`/corrections`** — the charter promises corrections at equal visibility; this makes the publication log operational before it is needed. Four change grades (Note / Clarification / Correction / Retraction), the five-step process, an append-only commitment, reporting guidance, and an honest empty state. It is informational; a data-minimizing public correction-intake channel is still unverified.

Both pages are linked from the nav, the homepage evidence + charter sections, and every footer.

### Phase 3 deployment record — 2026-08-26

- Owner command authorized the exact Phase 3-only scope; Package A was excluded.
- Deploy commit: `e8971ad0726695b70f99bf7fe4f7eb8434a8c8e6` (`Phase 3: source badges, sources page, corrections log`).
- Cloudflare build: `9f5e67e9-4ba0-4242-b66b-2107fbd5cd99`, successful at `2026-08-27T02:54:04.800Z` (`2026-08-26` in Alaska).
- Cloudflare deployment: `13ec93d6-7ba7-411b-864f-b7fd8cdcbdc9`; Worker version 4 ID `b6939236-5037-42a8-a659-b3f9219ca2e4`; 100% traffic.
- Independent HTTP checks passed for `/`, `/log`, `/sources`, `/corrections`, the custom 404, apex canonicals, and the `www` host.
- The live Mission Log contains exactly 10 missions, 10 source-basis badges, 10 Transparency lines, and 10 mission image references. Package A titles, IDs, and assets found: zero.
- All nine checked source/property links returned successful responses: eight `200` responses and an accepted `202` from AHRQ.
- The waitlist write path was deliberately not rerun during this content release, so no new test row was created or deleted. Its earlier end-to-end result remains a dated prior verification, not a fresh runtime claim.

## PWA — added 2026-09-25 (committed, awaiting push)

The site is now a real installable Progressive Web App. **This closed a live defect**, not just a feature request.

**The defect:** since the favicon release, all five pages carried `<link rel="manifest" href="/manifest.webmanifest">` and registered `/sw.js` — but **neither file has ever existed**, in either repo. The site was advertising itself as installable and silently failing every install attempt and every service-worker registration.

**Root cause:** `_ops/deploy-nooyouniverse.ps1` syncs a *fixed list* of filenames. `manifest.webmanifest` and `sw.js` were not on it, so they could never have reached the deploy repo even once written. The list has been extended.

**Added:**

- `manifest.webmanifest` — standalone display, five icons including maskable, app shortcuts to Mission Log / Sources / Corrections.
- `sw.js` — **network-first for documents, deliberately.** A cache-first document strategy would let an installed copy keep serving a page that has since been corrected, which would directly break the charter's corrections promise. Static assets are cache-first. Only same-origin GETs are intercepted, so the Supabase waitlist POST passes through untouched. Mission-log photography (~1 MB) is not precached.
- `offline.html` — this file already existed in the deploy repo, untracked, with **doubled `{{ }}` braces left over from an unrendered Python template**, making its CSS invalid. Fixed, brand-styled, added to source, and wired in as the service worker's offline fallback.

**Also reconciled:** the source repo had drifted behind the deploy repo *and* behind `origin/main` — missing Mission 11, the theme-colour/favicon head changes, and the PWA icons. Source now matches what is actually deployed. Note this drift is an upstream problem too: `origin/main`'s copy of `nooyouniverse.com/log.html` still has no Mission 11.

**Install path (no APK required):** Chrome on Android → nooyouniverse.com → ⋮ → *Install app*. Self-updating on every deploy, no sideloading, no signing keys. See `_ops/OWNER-ACTIONS-2026-09-25.md`.

## September reconciliation — 2026-09-24

The roadmap had drifted about four weeks behind the live site. Reconciled against `https://nooyouniverse.com` and both git remotes on 2026-09-24.

### 1. Mission 11 shipped, and it is not a Package A draft

`/log` now carries **eleven** entries. Mission 11 is **"Sleep before stack"** — badge `Health-agency source`, dated September 2026, sourced to NHLBI, listed in the `/sources` ledger (page last-reviewed 18 September 2026).

**It is none of the four Package A drafts.** Those remain unshipped. Mission 11 was authored and deployed outside the drafted approval queue, so the gate that Package A documents describe was not the path this entry took. Three consequences worth owner attention:

- **Provenance.** There is no record in this repo of who approved Mission 11 or on what review basis. The Package A approval machinery exists and was bypassed. Either the queue is the process or it isn't.
- **It substantially duplicates Mission 04.** "Check the Ship's Basics" already makes the sleep-as-context argument and cites the same NHLBI page. The log now says the same thing twice without acknowledging it. That is a small editorial problem and a slightly larger credibility one for a project whose charter is about not overstating.
- **Length and depth are well below the other ten.** Mission 11 is a single short paragraph against 400–700 words elsewhere. It reads as a placeholder next to entries 1–10.

Recommendation: either expand Mission 11 to the standard of the rest and explicitly frame it as a follow-on to Mission 04, or retire it and ship the Package A drafts through the documented gate. Not both, and not as-is indefinitely.

### 2. The Cloudflare auto-build hook is still broken — now confirmed twice

The 2026-08-26 deploy required a manual build invocation. The September deploy required a **committed dummy file**: `public/.deploy-poke`, whose own contents read —

> *"Redeploy poke from Castleborn Ops — 2026-09-18. Mission 11 (Sleep before stack) is on main; live host was still serving Missions 1–10. This file exists only to retrigger the Cloudflare Workers git deploy."*

So this is not a one-off. **Pushing to `main` does not reliably create a build**, and each release has needed a human to force it. Deploys are landing only because someone notices they haven't.

Leading hypotheses, in order, to check when someone is signed in to Cloudflare:

1. **The Git integration never fully established an automatic trigger.** The very first connection failed against an empty repository ("error occurred while fetching repository") and the first successful build came from a manual *Retry*. A trigger created in that broken state is the most likely culprit and would explain every subsequent failure.
2. **Build watch paths / path filters** configured such that ordinary content changes don't match.
3. **GitHub App installation permissions** on `castleism/nooyouniverse` lapsed or were scoped too narrowly to deliver webhooks.
4. Branch mismatch between the configured production branch and `main`.

Check in this order: Worker → Settings → Build → Git repository (trigger status, branch, watch paths), then GitHub → Settings → Applications → Cloudflare Workers & Pages → repository access.

**Until it is fixed, treat `.deploy-poke` as load-bearing** — it is currently the deploy mechanism, not a stray file. Do not delete it. Once the hook is repaired, remove it and record that the automatic path was re-tested with a real content change.

### 3. Repo state

- Deploy repo `castleism/nooyouniverse` — local synced to `12ca11f`.
- `MyPersonas` — local is **13 commits behind** `origin/main` and has pre-existing uncommitted local edits (`.github/workflows/*`, `MyPersonas.Online_v0/*`). The merge was deliberately **not** forced; those edits are the owner's to resolve. Run `git status` and either commit or stash before pulling.
- A stray copy of `SITE-ROADMAP.md` exists untracked in the deploy-repo root. Docs belong in the source repo only; it is not served (only `public/` is), but it should be removed to avoid two drifting copies.

### 4. Verification and hygiene completed 2026-09-24

- **All four outstanding factual claims from the ChatGPT package verified against primary sources — nothing fabricated.** Full record: `outputs/cillian-noo-youniverse/VERIFICATION-RECORD-2026-09-24.md`. One wording tighten applied to the Arizona Nutritional Supplements recall so it quotes FDA verbatim.
- **Blank forms renamed** so they cannot be mistaken for signed records: `…-APPROVAL-FORM-UNSIGNED-…`, `…-OWNER-DECISION-FORM-UNSIGNED-…`. The evidence-library seed is now `…-DO-NOT-PUBLISH-…`. Old filenames retained as pointer stubs; delete once nothing links to them.

## Package A continuation (drafted 2026-08-13)

Four approval-only Mission Log drafts now live at `outputs/cillian-noo-youniverse/mission-log/NOO-MISSION-LOG-PACKAGE-A-DRAFTS-2026-08-13.md`:

- Mission 11 — The P-Value Is Not the Payload (`Methodology reference`)
- Mission 12 — The Claim Is the Whole Constellation (`Regulatory guidance`)
- Mission 13 — Read the Flight Plan Before the Landing (`Methodology reference`)
- Mission 14 — Tracker Build Diary: A Field Is Not Yet a Measurement (`Methodology reference`)

State: **four copy drafts and four visual candidates prepared; zero owner approvals; zero human-review approvals; zero approved public assets; zero entries added to `log.html` or `sources.html`; zero deploys.** The visual-candidate folder includes provenance, literal alt text, QA notes, and checksums; candidates are not approvals. The first ten CIL-LW01 missions remain a closed launch sequence. The package proposes `CIL-ML02` as the new draft sequence key, but Christian must confirm it before use. If approved later, the new work should append as Missions 11–14.

The sources were checked on their current primary or official pages on August 13, 2026 and recorded in `SOURCE-AND-POLICY-LEDGER.md`. Mission 14 uses FDA measurement guidance only as a bounded design influence; it does not imply that the unbuilt consumer tracker is FDA governed, validated, compliant, cleared, or approved. Track A remains a recommendation awaiting an owner decision.

Publication gates remain unchanged: Christian must decide per entry; proposed public Transparency lines cannot be treated as human-reviewed until a human actually reviews them; Mission 14 additionally needs product, privacy, legal, health-safety, and technical review. Any later site integration must update the hard-coded ten-entry copy, table of contents, source table, and sitemap dates. Do not deploy Package A merely because Phase 3 is now live.

## Deploy architecture (as built)

Cloudflare **Worker with static assets** (not Pages — Cloudflare's Git-connect flow now defaults to Workers).

- `wrangler.jsonc` at deploy-repo root declares `./public` as the asset dir, `not_found_handling: "404-page"`.
- Build settings: build command *none*, deploy command `npx wrangler deploy`, root `/`.
- Everything served lives in `public/`; nothing above it is public.

### Gotchas learned during this deploy

- **Empty-repo build failure:** connecting Cloudflare to a repo *before* pushing code fails with "error occurred while fetching repository". Fix is Retry build after the first push, not reconfiguration.
- **Worker ≠ Pages:** a dashboard-created Worker ships a "Hello world" script that serves the domain until a successful asset build replaces it. Seeing "Hello world" means the build never succeeded.
- **Clean URLs:** Workers assets redirect `/log.html` → `/log` (a `307` was observed on 2026-08-26). Internal links, canonicals, og:url and sitemap all use the extensionless form.
- **Git hook drift:** the Phase 3 push did not automatically create a Cloudflare build even though the repository connection and trigger still existed. The existing trigger was manually invoked for the exact pushed commit; repair or revalidate automatic delivery before relying on it again.
- **Sandbox git:** locks can't be unlinked on this mount — rename them aside and commit via `GIT_INDEX_FILE` + `write-tree`/`commit-tree`/`update-ref`. `_ops/deploy-nooyouniverse.ps1` sweeps the debris.

## Overnight session notes (2026-08-09)

- Blanket owner authorization given for roadmap execution ("full permissions"); safety classifier still blocked unattended browser writes to Supabase/GitHub dashboards — those remain the only human steps.
- Sandbox git cannot unlink lock files on this mount; commits were made via plumbing (`GIT_INDEX_FILE` + `commit-tree` + `update-ref`). Stale `*.lock*`/`tmp_obj_*` debris in both repos' `.git` is harmless; the deploy script cleans it.
- Supabase SQL editor tab may contain a partial paste of migration 027 (typing was interrupted by the classifier ~line 8). Clear the editor and paste the file fresh — running the partial fragment would error harmlessly, but don't.

## Owner approvals — treated as granted 2026-08-09 ("full permissions" instruction), revert on request

- [x] Landing page copy (disclosure chip, tagline usage, charter lines, waitlist framing)
- [x] Launch-pack images 01+10 on site (hero/og) + all ten X-format images on Mission Log
- [x] Mission Log web adaptation of the 30-post pack's Facebook captions (platform-specific CTAs generalized; all Transparency lines kept verbatim)
- [x] Privacy/data-deletion links point to mypersonas.online pages for v1
- [x] Social handles listed text-only until account ownership verified

The exact Phase 3-only release was authorized, deployed, and independently verified on 2026-08-26. That approval did not extend to Package A, which remains a separate unapproved draft. Confirm any later release scope independently before using `-Publish`.

## Later phases (aligned to master roadmap)

- **Phase 3:** per-post source-basis badges, Sources, and Corrections are **verified live as of 2026-08-26**.
- **Phase 4 (newsletter):** the double-opt-in contract, lifecycle copy, ESP/compliance audit, QA, and owner-decision package are drafted under `outputs/cillian-noo-youniverse/newsletter/`. The waitlist currently stores emails only; nothing is sent. Before the first send: owner/operator decisions, lawful consent treatment, unsubscribe, sender identity and postal address, mailbox/domain authentication, current DNS verification, and restating Cillian's fictional identity in every email.
- **Phase 5 (product):** Observation Log build-diary series → waitlist segmentation. Requires product, privacy, security, legal and health review before *any* capability claim. Mission 09 describes it as unbuilt — that must stay accurate.
- **Press/collab kit:** blocked until a qualified reviewer is named (see below).
- **Content cadence:** publish future approved concepts as new `/log` entries as they clear the social approval queue (source of truth: `outputs/cillian-noo-youniverse/`). Give each a source-basis badge and add its source to `/sources`.

## Adjacent workstreams (specced 2026-08-13, unapproved)

The website is now the smallest piece of the plan. Current drafts and operating packages live in `outputs/cillian-noo-youniverse/`. Start with `strategy/NOO-EXECUTION-CONTROL-CENTER-2026-08-13.md`; it distinguishes finished local work from owner, specialist, and external gates.

- `app/NOO-APP-COMMUNITY-MODEL.md` v0.2 — reconciled detached-report proposal, Green-only/app-only launch recommendation, privacy/moderation gates
- `app/NOO-APP-COMMUNITY-OWNER-DECISIONS-2026-08-13.md` — 14 explicit owner choices; none inferred approved
- `app/NOO-APP-COMMUNITY-SOURCE-AUDIT-2026-08-13.md` — primary-source record for the corrected legal/privacy claims
- `app/NOO-APP-PRODUCT-SPEC.md` v0.2 — questionnaire, private current-use log, MyChart/FHIR, narrower **risk-tier gating**; suggestions/Overclocking retired from current scope
- `app/NOO-APP-SECURITY-COMPLIANCE.md` v0.2 — auth, encryption, RLS, audit, health-privacy posture, FDA function review, detached-publication addendum
- `app/implementation/` — boundary ADR, gated backlog, private-log contracts, 40 tier cases, 54 acceptance criteria, detached-publication blockers, and a synthetic local prototype plan; documentation only
- `mission-log/` — four Package A copy drafts and four unapproved visual candidates with provenance, alt text, QA, and checksums
- `evidence-library/` — nine provisional claim cards plus schema/JSON and approval record; qualified review still required
- `questionnaire/` — complete copy/field contract, tier and crisis messaging, 48-case QA, and owner choices; no intake system built
- `newsletter/` — double-opt-in integration contract, ESP/compliance audit, lifecycle copy, 53 QA checks, and owner decisions; no account or send
- `community-ops/` — voice, corrections, UGC, daily runbook, moderation, evidence preservation, and source/decision guide; no live operation
- `platform-strategy/` — official-source audit, readiness/funnel strategy, and proposed 30-day experiment plan; live account state remains unverified
- `category-intelligence/` — 12 positive project profiles, eight documented failure-side cases, and a combined original-format/guardrail synthesis; research only, with no outreach or copying authority
- `analytics/` — blank-safe weekly operating workbook; no real social metrics imported and all experiments remain Proposed
- `strategy/` — operating package plus the execution control center and ordered owner decision queue
- `supply-chain/` — v0.2 deferred business-case roadmap and unqualified candidate research; commerce is on Hold, with zero outreach or spend
- `HANDOFF-TO-CHATGPT-2026-08-13.md` — delegation brief for the other model

**The central product boundary:** the current proposal makes no app-generated treatment, medicine, supplement, amount, stack, combination, schedule, cycle, washout, or Overclocking plan. The specs recommend a private neutral log plus curated research, with a possible detached community library only after separate owner, legal, clinical, privacy, security, moderation, and adversarial linkability-review gates. FDA status remains function-specific; user-generated content creates no automatic legal safe harbor. Owner decisions are required before any build.

### Community model reconciliation — exact state

The supplied v0.1 community model was already present locally but conflicted with the binding risk tiers and overstated several legal/privacy conclusions. The v0.2 reconciliation now makes the following explicit:

- Amber and Red cannot browse or submit community reports; Red receives current-use/context logging, export/handoff, and immediate safety routing only.
- Mission 09 supports a neutral observation log, not prospective stack building, cycles, washouts, or one-tap publication.
- Individual reports are recommended app-only, authenticated, 21+, and Green-only at launch; public web receives no raw reports.
- Detached publication is a recorded owner direction but remains an unverified design objective, not an anonymity claim.
- Anonymous eligibility credentials, capability-based correction/deletion, separate security domains, human moderation, crisis interception before detachment, edge/log audit, and re-identification review are pre-launch gates.
- `k ≥ 20` is a provisional privacy floor, not a guarantee or legal safe harbor.
- Generic-compound-only/no-brand reporting is the recommended commerce boundary; it does not itself guarantee FTC compliance.

State of the **2026-08-13 community-model documentation sweep:** **zero new owner decisions; zero app code; zero community infrastructure; zero reviews/sign-offs; zero public-site page/code changes; roadmap documentation only; zero deploys during that bounded sweep.** Separately, the Phase 3 informational pages and badges were deployed and verified live on 2026-08-26; that did not activate any community operation or intake system.

## Open items the site cannot solve

From the master roadmap, still genuinely unresolved — the site is built to be honest about these rather than paper over them:

- **No named human health-claim approver.** Until one exists, content stays on methodology, regulatory explanation and agency summaries. Ingredient-, dose-, interaction- or condition-specific content is gated on this.
- **Social accounts unverified.** Instagram/Facebook/X appear as unlinked text ("coming online"). Link them only once ownership and write access are confirmed — a dead link on a trust-focused site is a self-inflicted wound.

### MyPersonas profile — live verification closed 2026-08-13

The signed-in profile was reopened in read-only mode and independently checked. The public About text now explicitly identifies Cillian as fictional, AI-assisted, human-reviewed, educational-only, and without personal product experience; the title is `Noo YouNiverse · Evidence Scout`; and the saved theme is deep auburn `#8f3f28`. The evidence-literacy focus and topic tags are aligned. No field was changed or saved in this verification session. The profile still has no posts and no public social links, which is the correct state while the launch packages and account ownership remain unapproved/unverified.

## Guardrails baked into the site

- Fictional/AI disclosure: hero chip, per-entry Transparency lines (×10), footer block, meta descriptions.
- No dosing, stacks, product claims, or first-person supplement stories anywhere; Mission 03/09 boundary language preserved verbatim.
- Evidence-tier legend matches the master roadmap taxonomy exactly.
- Social handles unlinked text until verified; only verified property linked is the AliaSpaces profile.
- Waitlist collects email only (insert-only RLS; anon cannot read); deletion path linked; 21+ statement included.

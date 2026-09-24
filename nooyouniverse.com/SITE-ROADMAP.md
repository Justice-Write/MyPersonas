# nooyouniverse.com — Site Roadmap

Updated: 2026-09-24 (live-state reconciliation and safe roadmap continuation prepared locally; no new deployment) · Owner: Christian · Persona: Cillian O'Sullivan / Noo YouNiverse

Stack: static site → **Cloudflare Worker with static assets** + Supabase free-tier email waitlist. This is not Cloudflare Pages. GitHub Pages remains a fallback (CNAME file included). Recorded infrastructure cost: $0/month; billing was not re-audited in this session.

## Status — 🟢 LIVE at https://nooyouniverse.com (fresh read-only verification 2026-09-24)

| Item | State |
|---|---|
| Landing page | ✅ Live |
| Mission Log — 11 entries (`/log`) | ✅ Live; Mission 11 is **Sleep before stack**, published 2026-09-18 |
| 404 page, robots, sitemap | ✅ Live |
| Waitlist table + RLS (migration 027) | ✅ Run in Supabase |
| Waitlist end-to-end | ✅ Dated prior verification: insert 201 · duplicate 409 · bad email 400 · anon read 401 (denied); not rerun on 2026-09-24 |
| Deploy repo `castleism/nooyouniverse` | ✅ Current inspected `origin/main` is `12ca11f`; Mission 11 entered in `5df5dd6` |
| Canonical source mirror | ⚠️ Mission 11 parity repair prepared and tested on an isolated local branch; not pushed or merged |
| Cloudflare Worker + apex domain | ✅ `/`, `/log`, `/sources`, `/corrections`, sitemap, robots, and favicon returned `200` on 2026-09-24; custom 404 confirmed |
| Deploy-only `.deploy-poke` | ⚠️ Still publicly reachable with `200` on 2026-09-24; local deploy candidate removes it, but that cleanup is not deployed |
| `www.nooyouniverse.com` | ✅ Resolves; pages declare apex canonicals; a host-level redirect is not configured |
| **Phase 3** — source badges, `/sources`, `/corrections` | ✅ **Verified live — 2026-08-26** |
| **Legacy Package A** — four drafts originally labeled Missions 11–14 | 📝 **Zero approved and zero deployed**; proposed collision-free public numbers are Missions 12–15, pending owner decision |
| Static security headers | 🧪 Conservative `_headers` candidate and QA prepared locally; not deployed |

### Outstanding — operations and owner-only follow-up

1. **Merge the canonical-source parity repair through the protected MyPersonas pull-request workflow.** This records already-public Mission 11 in source; it does not authorize another public content release.
2. **Approve an exact deploy cleanup/hardening release or keep it on hold.** The local candidate removes the publicly exposed `.deploy-poke` operational note and adds `_headers` with CSP, framing, MIME-sniffing, referrer, and browser-permission controls. It deliberately omits HSTS until the owner accepts the domain-wide operational commitment. Any release still requires preview, exact approval, deploy, and full live readback.
3. **Repair or revalidate the Cloudflare Git build hook.** The 2026-08-26 push did not automatically create a build. Do not assume a future push will deploy until the automatic path is tested again.
4. **Verify, then delete, 2 recorded test rows** in Supabase → Table Editor → `noo_waitlist`: `deploy-test-2026-08-09@nooyouniverse.com` and one `verify-…@example.com`. Their current presence was not rechecked in this session; confirm exact rows before deletion.
5. **Optional domain cleanup:** decide whether `www` should redirect to the apex at the host level. It currently serves successfully and declares the apex canonical, but does not redirect the browser.

## Phase 3 (built 2026-08-09; deployed and verified 2026-08-26)

- **Source-basis badges** on all ten entries included in the dated Phase 3 release. They label *what kind of support an entry rests on* — Health-agency source / Methodology reference / Regulatory guidance / Editorial promise · no efficacy claim / Introduction · no factual claim. Classifications taken verbatim from `SOURCE-AND-POLICY-LEDGER.md`; deliberately **not** framed as evidence tiers, because most entries teach method rather than assert empirical claims. Inventing a tier for a non-claim would be exactly the certainty theater the charter forbids. The later Mission 11 also carries a source-basis badge and source-ledger row.
- **`/sources`** — badge legend, per-mission source table with live links to NCCIH/AHRQ/NHLBI/FDA/FTC, the publication standard, and the hard-limits list ("what this project will never do").
- **`/corrections`** — the charter promises corrections at equal visibility; this makes the publication log operational before it is needed. Four change grades (Note / Clarification / Correction / Retraction), the five-step process, an append-only commitment, reporting guidance, and an honest empty state. It is informational; a data-minimizing public correction-intake channel is still unverified.

Both pages are linked from the nav, the homepage evidence + charter sections, and every footer.

### Phase 3 deployment record — 2026-08-26

- Owner command authorized the exact Phase 3-only scope; Package A was excluded.
- Deploy commit: `e8971ad0726695b70f99bf7fe4f7eb8434a8c8e6` (`Phase 3: source badges, sources page, corrections log`).
- Cloudflare build: `9f5e67e9-4ba0-4242-b66b-2107fbd5cd99`, successful at `2026-08-27T02:54:04.800Z` (`2026-08-26` in Alaska).
- Cloudflare deployment: `13ec93d6-7ba7-411b-864f-b7fd8cdcbdc9`; Worker version 4 ID `b6939236-5037-42a8-a659-b3f9219ca2e4`; 100% traffic.
- Independent HTTP checks passed for `/`, `/log`, `/sources`, `/corrections`, the custom 404, apex canonicals, and the `www` host.
- At that dated verification, the live Mission Log contained exactly 10 missions, 10 source-basis badges, 10 Transparency lines, and 10 mission image references, with zero legacy Package A titles, IDs, or assets. A separate Mission 11 was published later.
- All nine checked source/property links returned successful responses: eight `200` responses and an accepted `202` from AHRQ.
- The waitlist write path was deliberately not rerun during this content release, so no new test row was created or deleted. Its earlier end-to-end result remains a dated prior verification, not a fresh runtime claim.

## 2026-09-24 source and roadmap continuation — local only

- Reconciled the already-public Mission 11 (`Sleep before stack`) from deploy commit `5df5dd6` into the isolated canonical-source worktree, including homepage link, log entry, source-ledger row, sitemap dates, and the exact image asset.
- Added an eleven-test static-site and release contract covering Missions 01–11, table-of-contents and source-ledger parity, local assets, routes and fragments, apex canonicals and sitemap, public disclosure boundaries, the exact security-header allowlist, release-helper guards, a temporary-repository case/hidden-file preview regression, and legacy-candidate exclusion. All eleven tests pass locally.
- Added a conservative Cloudflare Workers static-assets `_headers` candidate and taught the preview-first deploy helper to include it. Current inline CSS/JavaScript and the exact Supabase waitlist origin are explicitly allowed; framing, plugins, MIME sniffing, referrer leakage, and unused browser capabilities are restricted. HSTS remains deliberately undecided.
- Found `public/.deploy-poke` in the deploy repository and confirmed it is publicly reachable. Its exact local deletion is prepared in the isolated deploy worktree. The live file remains until a separately approved deploy.
- Added `MISSION-LOG-RELEASE-QUEUE.md` to resolve the Mission 11 numbering collision without rewriting provenance.
- Added `REVENUE-MODEL.md` to turn the six-year portfolio scenario into a gate-controlled proposal. It records `$0` verified revenue from the dated administrative baseline and treats every price, goal, offer, app, and B2B engine as unapproved.
- Added `ROADMAP-PROGRESS-2026-09-24.md` as the current evidence, completed-work, blocker, backlog, and smallest-owner-action handoff.
- No file was pushed, merged, deployed, posted, sent, purchased, or used to change an external account during this continuation.

## Legacy Package A continuation (drafted 2026-08-13; numbering reconciled 2026-09-24)

Four approval-only Mission Log drafts remain in `outputs/cillian-noo-youniverse/mission-log/NOO-MISSION-LOG-PACKAGE-A-DRAFTS-2026-08-13.md`. Their original labels are preserved for provenance, but an unrelated Mission 11 is now public. The collision-free proposal is therefore:

- Proposed Mission 12 — The P-Value Is Not the Payload (`Methodology reference`)
- Proposed Mission 13 — The Claim Is the Whole Constellation (`Regulatory guidance`)
- Proposed Mission 14 — Read the Flight Plan Before the Landing (`Methodology reference`)
- Proposed Mission 15 — Tracker Build Diary: A Field Is Not Yet a Measurement (`Methodology reference`)

State: **four copy drafts and four visual candidates prepared; zero owner approvals; zero human-review approvals; zero approved public assets; zero legacy Package A entries added to the site; zero Package A deploys.** Keep original filenames and checksums unchanged. Create remapped publication copies only after approval. `CIL-ML02` and its proposed start at Mission 12 remain owner decisions.

The sources were checked on their current primary or official pages on August 13, 2026 and recorded in `SOURCE-AND-POLICY-LEDGER.md`; every source must be rechecked immediately before integration. Proposed Mission 15 uses FDA measurement guidance only as a bounded design influence. It does not imply that the unbuilt consumer tracker is FDA governed, validated, compliant, cleared, or approved. Track A remains a recommendation awaiting an owner decision.

Publication gates remain unchanged: Christian must decide per entry and per visual; proposed public Transparency lines cannot be treated as human-reviewed until a human actually reviews them. Proposed Mission 15 additionally needs product, privacy, legal/regulatory, health-safety, and technical review. Use `MISSION-LOG-RELEASE-QUEUE.md` as the current gate record. Do not deploy any legacy Package A work merely because Phase 3 and the separate Sleep before stack mission are live.

## Deploy architecture (as built)

Cloudflare **Worker with static assets** (not Pages — Cloudflare's Git-connect flow now defaults to Workers).

- `wrangler.jsonc` at deploy-repo root declares `./public` as the asset dir, `not_found_handling: "404-page"`.
- Build settings: build command *none*, deploy command `npx wrangler deploy`, root `/`.
- Everything served lives in `public/`; nothing above it is public.
- Cloudflare Workers static assets support a `public/_headers` file. The 2026-09-24 candidate is locally prepared only. Verification after any approved release must include response-header readback and a browser-side CSP-console plus waitlist submission check using an owner-approved test address, Supabase row readback, and exact-row cleanup; otherwise the waitlist path remains unverified under the new CSP.
- The deploy helper is now source-first and exact-sync: the reviewed source must already be merged to protected MyPersonas `main`; both canonical repositories must be clean and equal to `origin/main`; deploy-only public files are removed; native Git failures are checked; and only the deploy repository is committed and pushed. A worktree cannot publish.

### Gotchas learned during this deploy

- **Empty-repo build failure:** connecting Cloudflare to a repo *before* pushing code fails with "error occurred while fetching repository". Fix is Retry build after the first push, not reconfiguration.
- **Worker ≠ Pages:** a dashboard-created Worker ships a "Hello world" script that serves the domain until a successful asset build replaces it. Seeing "Hello world" means the build never succeeded.
- **Clean URLs:** Workers assets redirect `/log.html` → `/log` (a `307` was observed on 2026-08-26). Internal links, canonicals, og:url and sitemap all use the extensionless form.
- **Git hook drift:** the Phase 3 push did not automatically create a Cloudflare build even though the repository connection and trigger still existed. The existing trigger was manually invoked for the exact pushed commit; repair or revalidate automatic delivery before relying on it again.
- **Sandbox git history:** a prior mount required Git plumbing to avoid lock-file failures. The current deploy helper does not broadly delete `.git` locks; diagnose any future lock against the exact repository and process instead of assuming it is stale.

## Overnight session notes (2026-08-09)

- Blanket owner authorization given for roadmap execution ("full permissions"); safety classifier still blocked unattended browser writes to Supabase/GitHub dashboards — those remain the only human steps.
- That session used plumbing (`GIT_INDEX_FILE` + `commit-tree` + `update-ref`) around lock-file failures. This is dated history, not permission to remove unknown locks or bypass the current protected-source workflow.
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
- **Content cadence:** preserve the already-public Mission 11, then evaluate the four legacy Package A drafts under `MISSION-LOG-RELEASE-QUEUE.md` as proposed Missions 12–15. Publish only an exact cleared subset after separate copy, visual, source, specialist, integration, and release decisions. Give each released entry a source-basis badge and a matching `/sources` row.
- **Revenue path:** use `REVENUE-MODEL.md`. The lowest-risk first test is a bounded educational mission pack or source-reading tool, but even that needs a real audience baseline, owner-approved scope and price, rights/source/accessibility review, terms/refund/tax/payment decisions, and a capped pilot. App, B2B, sponsorship/affiliate, and physical-product engines remain progressively higher-gate proposals.

## Adjacent workstreams (specced 2026-08-13, unapproved)

The website is now the smallest piece of the plan. Current drafts and operating packages live in `outputs/cillian-noo-youniverse/`. Start with `strategy/NOO-EXECUTION-CONTROL-CENTER-2026-08-13.md`; it distinguishes finished local work from owner, specialist, and external gates.

- `app/NOO-APP-COMMUNITY-MODEL.md` v0.2 — reconciled detached-report proposal, Green-only/app-only launch recommendation, privacy/moderation gates
- `app/NOO-APP-COMMUNITY-OWNER-DECISIONS-2026-08-13.md` — 14 explicit owner choices; none inferred approved
- `app/NOO-APP-COMMUNITY-SOURCE-AUDIT-2026-08-13.md` — primary-source record for the corrected legal/privacy claims
- `app/NOO-APP-PRODUCT-SPEC.md` v0.2 — questionnaire, private current-use log, MyChart/FHIR, narrower **risk-tier gating**; suggestions/Overclocking retired from current scope
- `app/NOO-APP-SECURITY-COMPLIANCE.md` v0.2 — auth, encryption, RLS, audit, health-privacy posture, FDA function review, detached-publication addendum
- `app/implementation/` — boundary ADR, gated backlog, private-log contracts, 40 tier cases, 54 acceptance criteria, detached-publication blockers, and a synthetic local prototype plan; documentation only
- `mission-log/` — four Package A copy drafts and four unapproved visual candidates with provenance, alt text, QA, and checksums
- `MISSION-LOG-RELEASE-QUEUE.md` — current numbering, gate, and owner-decision record for those legacy drafts
- `REVENUE-MODEL.md` — proposed six-year business model, evidence gates, experiment ladder, and kill/pivot conditions; no forecast or commerce authority
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
- **No newsletter operating identity.** Legal sender/operator, physical postal address, monitored mailbox, sending domain, ESP, legacy-row treatment, and consent/retention decisions remain open. Existing waitlist rows are not confirmed newsletter subscribers.
- **No commerce authority or demand evidence.** The revenue model is planning only. No price, checkout, processor, entity/tax path, paid offer, outreach, spend, or revenue claim is approved.
- **No app/community build authority.** The reconciled product, privacy, security, legal, moderation, and health gates remain binding; documents and synthetic test plans are not a working product.

### MyPersonas profile — live verification closed 2026-08-13

The signed-in profile was reopened in read-only mode and independently checked. The public About text now explicitly identifies Cillian as fictional, AI-assisted, human-reviewed, educational-only, and without personal product experience; the title is `Noo YouNiverse · Evidence Scout`; and the saved theme is deep auburn `#8f3f28`. The evidence-literacy focus and topic tags are aligned. No field was changed or saved in this verification session. The profile still has no posts and no public social links, which is the correct state while the launch packages and account ownership remain unapproved/unverified.

## Guardrails baked into the site

- Fictional/AI disclosure: hero chip, per-entry Transparency lines (×11), footer block, meta descriptions.
- No dosing, stacks, product claims, or first-person supplement stories anywhere; Mission 03/09 boundary language preserved verbatim.
- Evidence-tier legend matches the master roadmap taxonomy exactly.
- Social handles unlinked text until verified; only verified property linked is the AliaSpaces profile.
- Waitlist collects email only (insert-only RLS; anon cannot read); deletion path linked; 21+ statement included.

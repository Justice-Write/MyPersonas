# Noo YouNiverse — Roadmap Progress

Prepared: 2026-09-24 AKDT
Owner: Christian
Scope: canonical website source, deploy artifact, release safety, Mission Log queue, six-year revenue direction, and all adjacent gates that can be advanced without owner, specialist, account, payment, publication, or production-data action
State: **SAFE LOCAL WORK COMPLETE — owner/external gates remain; nothing in this continuation has been pushed, merged, deployed, posted, sent, purchased, or used to change an account**

## Outcome

The current public site, canonical source, deploy repository, older Noo handoffs, community model, portfolio release ledger, and six-year planning brief were reconciled.

The largest drift was corrected locally: the public site has 11 missions, while the canonical source and planning records still stopped at 10. The unrelated public Mission 11, **Sleep before stack**, now exists in the isolated canonical-source worktree with matching homepage link, source row, sitemap dates, and image.

The old four-entry Package A remains unapproved. Because its first draft was also labeled Mission 11, the current review queue proposes remapping those preserved drafts to Missions 12–15. This is a numbering proposal, not content approval.

A second release problem was found: `public/.deploy-poke` is still publicly reachable and exposes a dated operational redeploy note. Its deletion is prepared locally. The deploy helper was rewritten so future releases are source-first, exact-sync, checked, and unable to publish from a worktree.

## Current verified truth

| Item | Evidence on 2026-09-24 | State |
|---|---|---|
| Main public routes | `/`, `/log`, `/sources`, `/corrections`, `/sitemap.xml`, `/robots.txt`, and `/assets/favicon.svg` returned `200`; custom 404 confirmed | Verified live |
| Mission Log | 11 articles, 11 source-basis badges, 11 Transparency lines, 11 local mission images; Mission 11 is `Sleep before stack` | Verified live |
| Legacy Package A leakage | Four old titles and candidate public paths were absent; candidate paths returned 404 | Verified absent from live site |
| `www` behavior | `www.nooyouniverse.com` serves successfully but does not redirect to apex; page canonicals use apex | Verified current behavior |
| Deploy-only poke | `https://nooyouniverse.com/.deploy-poke` returned `200` and the dated redeploy note | Verified live defect; local deletion only |
| Security headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and HSTS were absent from the live root response | Verified absent; local candidate only |
| Waitlist behavior | Prior records say insert `201`, duplicate `409`, invalid email `400`, anonymous read denied `401` | Dated prior verification; no write test performed now |
| Revenue | Portfolio administrative baseline records `$0`; no bank, accounting, processor, tax, or invoice audit was performed | Recorded baseline, not independent financial verification |
| Social accounts | Destinations are recorded, but current write roles, recovery, 2FA, account health, recommendation status, reach, and conversion remain unverified | External/account gate |

## Completed locally

| Workstream | Completed result | Evidence / acceptance |
|---|---|---|
| Isolated work | Source worktree `MyPersonas-noo-roadmap-20260924`; deploy worktree `nooyouniverse-roadmap-20260924`; both started from fetched `origin/main` | User-owned shared dirty checkouts were not altered |
| Canonical source repair | Reconciled the exact already-public Mission 11 page, source-ledger, homepage, sitemap, and 93,660-byte image from deploy commit `5df5dd6` | Image SHA-256 matches deploy; structural tests pass |
| Mission queue | Added `MISSION-LOG-RELEASE-QUEUE.md` | Remaps legacy drafts to proposed Missions 12–15; every copy/source/visual/owner/specialist gate remains explicit |
| Revenue plan | Added `REVENUE-MODEL.md` | Six-year ranges are labeled planning goals, not forecasts; `$1B` arithmetic is retained as a stress test; no price or offer approved |
| Current roadmap | Updated `SITE-ROADMAP.md` and added the source `README.md` | Live 11-mission truth, numbered queue, revenue path, release boundary, and current blockers now align |
| Static response hardening | Added `_headers` in canonical source and deploy candidate | Exact CSP allowlist, framing denial, MIME-sniffing denial, no-referrer, and unused browser-capability restrictions; HSTS deliberately omitted |
| Release safety | Rewrote `_ops/deploy-nooyouniverse.ps1` | Read-only default; explicit deploy target in preview; both primary canonical checkouts required for publication; exact GitHub origins; clean `main == origin/main`; checked native Git exits; source PR/merge first; hidden-file and case-sensitive exact sync; filter-aware preview; deploy-only removal; post-sync byte/set parity plus staged-blob parity; deploy repo only |
| Deploy cleanup | Deleted `public/.deploy-poke` in the isolated deploy candidate | Local deletion preserved in the isolated deploy branch for later review; live defect remains until an approved deployment |
| Deploy documentation | Updated deploy `README.md` | Git hook described as fallible; live verification required |
| Static QA | Added `tests/noo-static-site.test.mjs` | 11 focused tests pass: Mission 01–11 integrity, sources, images, routes/fragments, canonicals/sitemap, disclosures, exact CSP/permissions policy, release-helper guards, a temporary-repository case/hidden-file preview regression, and legacy-candidate exclusion |
| Repository QA | Ran the complete MyPersonas Node test suite | **504 passed, 0 failed, 0 skipped** |
| Cloudflare packaging | Wrangler `4.137.0` production dry run against the isolated deploy candidate | Passed; 25 static-asset files read; no binding; `--dry-run` exited without deployment |
| PowerShell validity | Parsed under PowerShell 7 and ran a full read-only preview under Windows PowerShell 5.1 | Zero parse/runtime errors in either host |
| Whitespace review | `git diff --check` on both worktrees | Passed; only expected Windows line-ending notices |

## What remains, in dependency order

### 1. Repository and release gates

1. Review the local source and deploy commits; neither has been pushed.
2. Push the source branch and open the protected MyPersonas pull request only after owner authorization.
3. Pass the required MyPersonas CI and merge the exact source change.
4. Update the canonical MyPersonas `main` checkout and the deploy `main` checkout to current `origin/main`; both must be clean.
5. Run the new helper in preview mode and review every add/change/delete.
6. Obtain a separate owner decision for the exact deploy scope:
   - remove `.deploy-poke`;
   - add `_headers`;
   - make no content release beyond recording the already-public Mission 11 parity.
7. Publish only from canonical clean `main`, then verify the exact Cloudflare build and deployment. Do not infer that the Git hook ran.
8. Read back routes, content, assets, canonicals, 404 behavior, and every intended header.
9. Because CSP affects the waitlist, use an owner-approved test address for one browser submission; inspect the browser console, verify the exact Supabase row, and remove only that row. Without this step, keep the waitlist-under-CSP state unverified.

### 2. Existing production cleanup

- Verify the two historically recorded waitlist test rows still exist before deleting either one.
- Decide whether `www` should redirect to apex. Keep HSTS on hold until apex, `www`, fallback hosting, and every affected subdomain are reviewed.
- Repair or revalidate the Cloudflare Git build hook.
- Decide whether to create a privacy-minimized correction-intake route. The current Corrections page is informational, not an intake system.

### 3. Content and reviewer gates

- Confirm or replace the proposed `CIL-ML02` sequence and Missions 12–15 numbering.
- Decide each legacy Package A copy and visual separately: approve for review, revise, deny, or hold.
- Name an editorial/source reviewer and backup.
- Name a qualified health/clinical/pharmacy reviewer and define scope, credentials, availability, and turnaround.
- Recheck every source immediately before integration.
- Proposed Mission 15 additionally requires product, privacy, legal/regulatory, health-safety, and technical review.
- Create a rendered-artifact review record that binds reviewer, date, scope, and hash before any future public “human-reviewed” claim.

### 4. Distribution and owned audience

- Authorize a read-only Instagram/Facebook/X audit; verify ownership, roles, recovery, 2FA, account health, public URLs, and a clean baseline.
- If the baseline is accepted, approve an exact methodology-only pilot with one variable, stop rule, safety pause, exact posts, visuals, destinations, and operator.
- Newsletter remains blocked on legal sender/operator, physical address, monitored mailbox, sending domain, ESP, 21+ confirmation, legacy-row treatment, consent, retention/deletion, authentication, unsubscribe, suppression, bounce/complaint, reconciliation, and send authority.

### 5. Revenue path

- Decide Noo's portfolio role. Recommended: audience-and-trust brand, with MyPersonas/Soul Concept Engine remaining the infrastructure engine.
- Choose the first revenue experiment or choose no paid experiment. Recommended first test: a bounded educational mission pack or source-reading tool, not an app, supplement product, or personalized recommendation.
- Before pricing: establish a verified audience baseline, exact deliverable, rights/source/accessibility review, entity/seller, tax, processor, refund/support, cost floor, margin model, fulfillment, reconciliation, and capped pilot.
- Keep Sources, Corrections, limitations, and safety-critical information outside any paywall.
- Keep editorial/evidence decisions firewalled from B2B clients, sponsors, affiliates, and future products.

### 6. App and community

No app or community implementation is authorized. Decisions D01–D14, questionnaire choices, synthetic-prototype authorization, and all privacy, security, legal, clinical, moderation, crisis, deletion, linkability, jurisdiction, and incident-response gates remain open. The conservative product boundary remains:

- no medicine output;
- no supplement, dose, stack, combination, schedule, cycle, washout, or treatment recommendation;
- private neutral current-use/context log before any community feature;
- no diagnosis-based matching or hidden “for you” ranking;
- Green/21+-only community access if that workstream ever clears every launch gate;
- no claim of anonymity from a provisional `k ≥ 20` threshold.

## Exact blockers and smallest owner action

| Blocker | Why the assistant cannot clear it | Smallest owner action |
|---|---|---|
| Source PR | Push/PR is an external repository change | Say: **Approve the Noo source branch push and protected PR; no deployment.** |
| Deploy cleanup and headers | Changes the public site and waitlist browser policy | After source merge, approve or hold the exact two-item deploy scope: remove `.deploy-poke`; add `_headers` |
| Mission numbering | Canon/content identity decision | Approve, revise, or deny the proposed remap to Missions 12–15 and `CIL-ML02` start at 12 |
| Future missions | Copy and visuals remain unapproved | Decide each copy and visual separately; “approve for review” is not publication approval |
| Health-adjacent expansion | Qualified human judgment is absent | Name the health/clinical/pharmacy reviewer and scope, or keep the work held |
| Social baseline | Requires signed-in account access and owner authority | Approve read-only verification of the three exact destinations |
| Newsletter | Requires identity, legal, provider, DNS/mailbox, consent, and operational choices | Name operator, legal sender, postal address, monitored mailbox, sending domain, and legacy-row treatment |
| First paid test | Price/entity/payment/tax/support are owner/business decisions | Choose mission pack, source tool, membership, course, or no paid experiment |
| Test-row deletion | Destructive production-data action | Authorize read-only verification first, then exact deletion only if the two rows match |
| `www` and HSTS | Domain-wide operational commitment | Choose redirect or current dual-host behavior; keep HSTS held until review |
| App/community | Owner and multiple specialist gates | Decide D01–D14 before any build authorization |

## Recommended next decision

The smallest useful next move is:

1. **Approve the source branch push and protected PR only.**
2. **Approve the collision-free Missions 12–15 numbering proposal only, without approving any copy, image, integration, or release.**
3. Keep the public deploy on hold until the source PR is merged and the exact deploy diff is shown again.

After that review, the next highest-priority public action is the narrow cleanup/hardening release that removes `.deploy-poke` and adds `_headers`, followed by the explicit browser waitlist/CSP verification.

## Intent-aligned suggestions

- Make Noo's moat the practice of interrogating claims, not selling certainty or supplements.
- Treat “Unknown,” null results, corrections, and source limitations as recurring products, not embarrassing edge cases.
- Prove repeat attention and reviewer throughput before app breadth.
- Prefer one paid educational artifact before recurring membership; prefer recurring education before health-data software; keep physical product commerce last.
- Externalize inline CSS and JavaScript in a later visual-regression-tested hardening pass so CSP can eventually remove `'unsafe-inline'`.
- Create a compact review manifest for every public mission: exact source hash, rendered hash, reviewer, scope, date, limitations, visual/provenance check, and correction owner.
- Keep the public website a curated trust spine. Do not publish raw community reports to it.
- Measure source use, qualified return behavior, corrections quality, and consented conversion before raw follower growth.

## Stop condition reached

Every remaining item now requires at least one of:

- an owner decision;
- a named qualified reviewer;
- signed-in account access or a provider/DNS choice;
- production-data verification or deletion authorization;
- payment/entity/tax approval;
- publication/deployment authorization; or
- implemented product evidence that does not yet exist.

No further external or gate-crossing action is implied by this progress record.

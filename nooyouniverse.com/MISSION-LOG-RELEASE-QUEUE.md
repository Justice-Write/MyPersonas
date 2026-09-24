# Noo YouNiverse — Mission Log release queue

Prepared: 2026-09-24
Owner: Christian
Persona: Cillian O'Sullivan / Noo YouNiverse
State: **REVIEW ONLY — no Package A copy, visual, sequence, integration, or release approval is recorded here**

## Why this queue exists

The August 13 Package A file reserved Missions 11–14 for four unapproved drafts. That numbering is no longer available. The current deploy source contains an unrelated, already-published Mission 11:

- **Mission 11 — Sleep before stack**
- Added in deploy commit `5df5dd68cc958f56a190febf64e6870b0d9974cd`
- Current deploy-repository head inspected: `12ca11fb8ee1ca87797069ee034976acf90cb83a`
- Current route/source placement: `/log#mission-11`, with a matching `/sources` row and `assets/log/11-sleep-before-stack.jpg`

The portfolio release ledger reports the public site and favicon verified live on 2026-09-23. Fresh read-only HTTP checks on 2026-09-24 also returned `200` for `/`, `/log`, `/sources`, `/corrections`, `/sitemap.xml`, `/robots.txt`, the favicon, and the Mission 11 image; confirmed the custom 404; and found the live Mission 11. The log contained 11 mission articles and exactly one `mission-11`; the source table contained one Mission 11 row; the homepage linked to `/log#mission-11`; and none of the four legacy Package A titles appeared on those checked pages. Direct checks of all four candidate filenames under the public mission-image path returned `404`. The `www` host still serves successfully without redirecting to the apex.

The old Package A drafts therefore cannot keep their proposed public numbers. This queue proposes **Missions 12–15** while preserving the original draft files and filenames as provenance. The proposal is not an owner decision.

## Current truth and integration boundary

1. **Live/deploy truth:** Mission 11 is “Sleep before stack.” It is not one of the four August 13 Package A drafts.
2. **Package A truth:** the four old copy drafts and four visual candidates still exist locally. Their recorded checksums matched on 2026-09-24. They remain unapproved candidates.
3. **Source reconciliation prepared locally:** on 2026-09-24, the exact already-public Mission 11 changes were copied from the deploy repository into the `MyPersonas/nooyouniverse.com/` worktree: `index.html`, `log.html`, `sources.html`, `sitemap.xml`, and `assets/log/11-sleep-before-stack.jpg`.
4. **Local QA:** the reconciled source passed the local checks for the Mission 01–11 sequence, table of contents, source ledger, assets, internal routes/fragments, clean canonicals/sitemap, and disclosures. This is a locally prepared source reconciliation until its later Git/release state is recorded; it is not new Package A approval.
5. **No legacy Package A copy or candidate image is known to be public.** The stale problem is the mission-number label: saying “Missions 11–14 are not live” is now misleading because a different Mission 11 is live.

## Reconciled numbering proposal

| Original draft label | Proposed public label | Title | Candidate source filename | Publication filename only after approval |
|---|---:|---|---|---|
| Draft Mission 11 | **Mission 12** | The P-Value Is Not the Payload | `mission-11-p-value-not-payload-candidate.png` | `12-p-value-not-payload` with the approved export format |
| Draft Mission 12 | **Mission 13** | The Claim Is the Whole Constellation | `mission-12-claim-constellation-candidate.png` | `13-claim-constellation` with the approved export format |
| Draft Mission 13 | **Mission 14** | Read the Flight Plan Before the Landing | `mission-13-flight-plan-candidate.png` | `14-flight-plan` with the approved export format |
| Draft Mission 14 | **Mission 15** | Tracker Build Diary: A Field Is Not Yet a Measurement | `mission-14-observation-blueprint-candidate.png` | `15-observation-blueprint` with the approved export format |

Rules for the remap:

- Keep the internal August 13 filenames unchanged so their provenance and checksums remain traceable.
- If an entry clears every gate, create a separately named publication copy. Never copy an old candidate into the public tree under its obsolete number.
- Mission 11 remains exactly where it is. Do not overwrite it, renumber it, or silently assign it to the proposed `CIL-ML02` sequence.
- `CIL-ML02` remains a proposed sequence key. The owner must confirm or replace it and decide whether it begins with Mission 12; no retroactive sequence assignment is inferred.
- Update the old draft's proposed month/log line during final editorial review. “August 2026” is provenance, not an acceptable future publication date.

## Local review materials

These materials are deliberately local and gitignored. The repo-relative paths below exist in the canonical checkout where `outputs/` is retained; they are not public URLs and do not imply approval.

- Package A copy drafts: `../outputs/cillian-noo-youniverse/mission-log/NOO-MISSION-LOG-PACKAGE-A-DRAFTS-2026-08-13.md`
- Visual provenance, prompts, draft alt text, and QA: `../outputs/cillian-noo-youniverse/mission-log/package-a-visual-candidates-2026-08-13/README.md`
- Visual checksum ledger: `../outputs/cillian-noo-youniverse/mission-log/package-a-visual-candidates-2026-08-13/ASSET-CHECKSUMS.csv`
- Source and policy ledger: `../outputs/cillian-noo-youniverse/launch-week-2026-08-08/SOURCE-AND-POLICY-LEDGER.md`
- Mission 12 candidate — formerly draft 11: `../outputs/cillian-noo-youniverse/mission-log/package-a-visual-candidates-2026-08-13/mission-11-p-value-not-payload-candidate.png`
- Mission 13 candidate — formerly draft 12: `../outputs/cillian-noo-youniverse/mission-log/package-a-visual-candidates-2026-08-13/mission-12-claim-constellation-candidate.png`
- Mission 14 candidate — formerly draft 13: `../outputs/cillian-noo-youniverse/mission-log/package-a-visual-candidates-2026-08-13/mission-13-flight-plan-candidate.png`
- Mission 15 candidate — formerly draft 14: `../outputs/cillian-noo-youniverse/mission-log/package-a-visual-candidates-2026-08-13/mission-14-observation-blueprint-candidate.png`

All four candidate files existed and matched `ASSET-CHECKSUMS.csv` on 2026-09-24. That is an integrity check, not a visual, rights, accessibility, editorial, or owner approval.

## Entry gates

### Proposed Mission 12 — The P-Value Is Not the Payload

**Copy gate**

- Owner records **Approve for human review**, **Revise**, or **Deny** for this exact remapped entry.
- Final copy must preserve the difference among statistical significance, estimate size, uncertainty, and practical meaning.
- It must not translate `p < 0.05` into “proven,” `p > 0.05` into “nothing happened,” or turn a methods lesson into an intervention verdict.
- The public Transparency line may say “human-reviewed” only after a human completes and records the review.

**Source gate**

- Re-open and re-check the American Statistical Association p-value statement and the current Cochrane Handbook Chapter 15 immediately before integration.
- Confirm each sentence stays inside what those sources support; record the check date and reviewer.
- Keep the source-basis badge **Methodology reference**. Do not assign an efficacy tier because the draft makes no efficacy claim.

**Visual gate**

- Owner decides the visual separately from the copy.
- Human review must confirm the final crop, literal alt text, and absence of a study result, product, molecule, person, clinician, medical dashboard, or implied efficacy verdict.
- Export under the new Mission 12 filename only after approval; preserve the original candidate and checksum.

**Specialist and owner gates**

- Required by the existing record: human editorial/source review plus owner copy, image, numbering, and sequence decisions.
- Recommended, not currently recorded as a mandatory specialist gate: a statistics/methods reviewer for the final interpretation wording.
- If editing introduces a health outcome, named intervention, population-specific conclusion, or product claim, the named health/clinical approver becomes mandatory before publication.

**Ship state:** **NO-GO** — owner decision and human review are absent.

### Proposed Mission 13 — The Claim Is the Whole Constellation

**Copy gate**

- Owner records **Approve for human review**, **Revise**, or **Deny** for this exact remapped entry.
- Keep it a general reading tool about express claims, implied claims, net impression, omissions, and qualifications.
- Preserve the limits: it is not a legal verdict, safe harbour, accusation, or finding about a named advertiser.
- The public Transparency line may say “human-reviewed” only after that review actually occurs.

**Source gate**

- Re-open and re-check the current official FTC Health Products Compliance Guidance immediately before integration.
- Verify the net-impression and disclosure language against the current source and record the check date and reviewer.
- Keep the source-basis badge **Regulatory guidance**; do not imply that FTC guidance adjudicates a specific ad.

**Visual gate**

- Review the final, twice-edited candidate—not the preserved superseded draft.
- Human visual review must confirm that the data tile is non-biological, the graph is neutral rather than a success trajectory, all cards remain unreadable/anonymous, and no brand, product, testimonial face, clinician, patient, efficacy result, or verdict is implied.
- Owner decides the final image and literal alt text separately from the copy.

**Specialist and owner gates**

- Required for the generic draft: human editorial/source review plus owner copy, image, numbering, and sequence decisions.
- Legal review becomes mandatory if the entry is paired with, revised around, or applied to a named real claim, brand, advertiser, screenshot, or dispute.
- A health/clinical approver becomes mandatory if a revision interprets a specific health-product or outcome claim.

**Ship state:** **NO-GO** — owner decision and human review are absent.

### Proposed Mission 14 — Read the Flight Plan Before the Landing

**Copy gate**

- Owner records **Approve for human review**, **Revise**, or **Deny** for this exact remapped entry.
- Preserve the difference between reporting completeness and study quality. CONSORT is not a truth detector, misconduct finding, or efficacy score.
- Do not attach the lesson to a named trial, intervention, condition, or result without a separately reviewed expansion.
- The public Transparency line may say “human-reviewed” only after a recorded human review.

**Source gate**

- Re-open and re-check the current CONSORT 2025 statement and its status immediately before integration.
- Verify the wording about registration, protocol/analysis plan, outcomes, changes, participant flow, missing data, estimates, harms, funding, conflicts, and limitations.
- Keep the source-basis badge **Methodology reference** and record the source-review date.

**Visual gate**

- Human review must confirm that the three-sheet navigation metaphor remains readable without fake text and that the documented course correction does not imply wrongdoing.
- Confirm no product, condition, intervention, patient, clinician, result, success graph, verdict, logo, or watermark appears.
- Owner decides the image, crop, and literal alt text separately from the copy.

**Specialist and owner gates**

- Required for the generic draft: human editorial/source review plus owner copy, image, numbering, and sequence decisions.
- A health/clinical approver and, where relevant, legal review become mandatory if the entry is revised to assess a named health trial, intervention, sponsor, or result.

**Ship state:** **NO-GO** — owner decision and human review are absent.

### Proposed Mission 15 — Tracker Build Diary: A Field Is Not Yet a Measurement

**Copy gate**

- Owner records **Approve for human review**, **Revise**, or **Deny** for this exact remapped entry.
- The copy must continue to say the tracker is **unbuilt**, Track A is a recommendation rather than an approved product direction, and no validated score or recommendation engine exists.
- It must not claim the proposed consumer tracker is “FDA aligned,” validated, governed, compliant, cleared, approved, diagnostic, prescriptive, or clinically meaningful.
- It must retain easy correction/deletion, explicit missingness, versioning, uncertainty, and the prohibitions on diagnosis, medicine/supplement recommendations, doses, combinations, and care changes.
- The public Transparency line may say “human-reviewed” only after every required review below is complete.

**Source gate**

- Re-open and re-check the current official FDA PFDD Guidance 3 page immediately before integration.
- Confirm that the borrowed fit-for-purpose measurement discipline is accurately bounded to its medical-product-development and regulatory-decision context.
- Record the source check and preserve the explicit statement that the guidance does not approve, validate, govern, or certify this proposed consumer tracker.

**Visual gate**

- Human review must confirm that the candidate remains visibly conceptual and unbuilt, with neutral modules and an unresolved state.
- Confirm it contains no clinical dashboard, score, diagnosis, medicine, supplement, dose, patient, clinician, brain, health result, approval mark, app logo, or implied validation.
- Owner decides the image, crop, and literal alt text separately from the copy; export only under the new Mission 15 filename after approval.

**Mandatory specialist and owner gates**

- Owner: remapped number, `CIL-ML02` decision, exact copy, exact visual, Transparency line, Track A/product-boundary decision, local integration scope, and later release scope.
- Human editorial/source review.
- Product review.
- Privacy review.
- Legal/regulatory review.
- Health-safety review.
- Technical review.
- If the entry is expanded to describe real collection, storage, analysis, deletion, sync, sharing, or security behavior, a privacy/security architecture review and evidence of the implemented behavior are also mandatory. A design document cannot substitute for working-system evidence.

**Ship state:** **NO-GO** — the owner and all named specialist gates remain open.

## Cross-entry gates

These apply even if only one entry advances:

1. **Canonical baseline:** preserve the locally reconciled, structurally validated Mission 11 source and record its reviewed Git state before any later Package A integration. Never rebuild or overwrite that entry from the old ten-entry snapshot.
2. **Per-entry owner decision:** approval is individual; no batch approval may be inferred.
3. **Sequence decision:** confirm or replace `CIL-ML02` and decide whether it begins at Mission 12.
4. **Copy/source review:** a named human must check exact source fidelity, claim scope, date, links, and the final Transparency line.
5. **Health-claim boundary:** no ingredient-, dose-, interaction-, condition-, medicine-, adverse-event-, safety-, or personalized-health claim ships without a named qualified health/clinical/pharmacy approver and current evidence. The current drafts must stay methods/regulatory/unbuilt-design only while no approver is named.
6. **Visual review:** owner selection, human visual/source review, accurate final-crop alt text, synthetic-media disclosure, provenance, rights, and checksum/export record.
7. **Local integration QA:** use the reconciled source; append only cleared entries; add matching `/sources` rows; update count-dependent copy, metadata, table of contents, link targets, sitemap review dates, and image paths; run accessibility, responsive, link, and content-boundary tests.
8. **State separation:** approval for human review is not final approval; final approval is not local integration; local integration is not a commit; a commit is not a push; a push is not a deploy; a deploy is not verified live.
9. **Release authorization:** deployment requires a later, exact owner decision naming the approved entries and assets. Do not bundle another workstream.

## What can and cannot ship

| State | Allowed now? | Exact boundary |
|---|---:|---|
| This release-queue document | **Yes, review only** | May be tracked as planning truth; it changes no public content or asset |
| Package A copy or visual sent to a reviewer | **Only after owner selects “Approve for human review” for that exact item** | Reviewer circulation is not public approval |
| Renumbered Package A entry staged in canonical site source | **No** | Mission 11 is reconciled locally, but every entry-specific gate and an exact local-integration decision remain open |
| Any Package A mission or candidate asset deployed | **No** | Requires cleared copy/source/visual/specialist gates plus a separate exact deploy authorization |
| Mission 15 tracker capability claim | **No** | Requires implemented evidence and every product/privacy/legal/health-safety/technical gate; the present entry may only describe an unbuilt concept |
| Existing live Mission 11 | **Already public; preserve** | It is outside Package A and must not be overwritten or silently reclassified |

## Owner decision table

Silence is not approval. Record decisions in the authoritative owner record, then link that record here; do not turn this template into an inferred approval.

| Decision | Available response | Current state | Smallest action needed |
|---|---|---|---|
| Keep live Mission 11 unchanged and remap the four old drafts to 12–15 | Approve / Revise | Pending | Owner confirms or supplies a different collision-free numbering plan |
| Proposed sequence key `CIL-ML02`, beginning at Mission 12 | Approve / Revise / Deny | Pending | Owner confirms the exact key and starting mission |
| Mission 12 copy — P-Value | Approve for human review / Revise / Deny | Pending | One decision plus revision notes if needed |
| Mission 12 visual — P-Value | Approve for human review / Revise / Deny | Pending | Separate image decision; copy approval does not carry over |
| Mission 13 copy — Claim Constellation | Approve for human review / Revise / Deny | Pending | One decision plus revision notes if needed |
| Mission 13 visual — Claim Constellation | Approve for human review / Revise / Deny | Pending | Separate image decision; select only the final edited candidate |
| Mission 14 copy — Flight Plan | Approve for human review / Revise / Deny | Pending | One decision plus revision notes if needed |
| Mission 14 visual — Flight Plan | Approve for human review / Revise / Deny | Pending | Separate image decision |
| Mission 15 copy — Measurement Field | Approve for human review / Revise / Deny | Pending | One decision; this does not approve Track A or an app |
| Mission 15 visual — Measurement Field | Approve for human review / Revise / Deny | Pending | Separate image decision |
| Named editorial/source reviewer | Name / Hold | Unassigned | Name the reviewer and scope, or keep all four blocked |
| Mission 15 specialist reviewers | Name each / Hold | Unassigned | Product, privacy, legal, health-safety, and technical reviewers must each be identified |
| Local integration after all prior gates | Approve exact cleared subset / Hold | Not ready | Decide only after review evidence exists and source drift is repaired |
| Deployment after verified local QA | Approve exact release / Hold | Not ready | Separate decision naming exact copy, images, commit, destination, and rollback point |

## Stale or collision-prone statements found

### Current-state records that still need reconciliation

- `outputs/cillian-noo-youniverse/00-READ-ME-FIRST.md` still calls the public Mission Log ten-entry and refers to Package A as Missions 11–14.
- `outputs/cillian-noo-youniverse/strategy/NOO-EXECUTION-CONTROL-CENTER-2026-08-13.md` still describes the current public site as ten-entry and queues Missions 11–14.
- `outputs/cillian-noo-youniverse/strategy/NOO-STRATEGY-OPERATING-PACKAGE-2026-08-13.md`, the category-intelligence dossier, analytics read-first file, and the 2026-09-23 portfolio release ledger still use “Package A Missions 11–14.” The underlying non-publication claim remains true, but the labels are collision-prone and should be superseded by **legacy Package A drafts, proposed Missions 12–15**.
- `outputs/cillian-noo-youniverse/HANDOFF-TO-CHATGPT-2026-08-13.md` contains both valid dated ten-entry release history and present-tense continuation instructions that still say to append after Mission 10. Future work must follow this queue instead.
- The Package A draft, visual README, checksum filenames, and source-ledger rows retain original Mission 11–14 labels. Keep those original files unchanged for provenance, but add a supersession note or use this queue whenever decisions are recorded.

### Stale source statement resolved locally in this worktree

- The MyPersonas source mirror previously said “ten” and omitted the already-public Mission 11. The current 2026-09-24 worktree now contains the exact deploy-source Mission 11 across the page, table of contents, source row, homepage link, sitemap dates, and image asset, and its structural QA passes. Do not describe that reconciliation as committed, pushed, or newly deployed until those later states are separately recorded.
- `nooyouniverse.com/SITE-ROADMAP.md` now reports the current 11-entry state and remaps the legacy queue to proposed Missions 12–15. Its references to ten missions inside the expressly dated Phase 3 section remain valid 2026-08-26 release history rather than current-state claims.

### Dated statements that remain valid history

- The Phase 3 release-readiness record and the 2026-08-26 deployment record correctly describe a ten-entry site and zero Package A leakage **at that time**.
- “No legacy Package A copy or candidate asset has been deployed” remains the supported statement from the inspected repositories. Do not shorten it to “Mission 11 is not live,” because that is now false.

## Definition of queue completion

This queue is complete only when each entry is either denied or has:

- an owner-approved final number, sequence, copy, source line, Transparency line, visual, crop, and alt text;
- dated human editorial/source approval;
- every applicable specialist approval, including all five mandatory Mission 15 reviews;
- integration on top of a canonical source tree that already contains the exact live Mission 11;
- passing local accessibility, responsive, link, source-boundary, and public-artifact checks;
- a separately approved release scope and rollback point; and
- post-deploy route, content, asset, source-link, canonical, and no-leak verification.

Until then, the four entries remain review candidates—not queued public posts.

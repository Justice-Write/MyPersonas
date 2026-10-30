# PR22 content-report and moderation security design

This document is the current-main extraction record for the still-useful design
intent in open PR #22. It is not approval to merge or cherry-pick that branch,
apply migration 080, enable a reporting client, expose a staff queue, take a
moderation action, deploy either product or process real report data.
`publishing_enabled` remains `false`.

PR #22 was a useful first-party reporting prototype, but its October 16 source
predates the current migration, privacy, retention, audit and cross-product
boundaries. The branch must be extracted by capability and redesigned under the
current ledger. It must not be merged or cherry-picked as a unit.

## Extraction and disposition matrix

| PR #22 area | Current decision | Evidence or required replacement |
|---|---|---|
| Migration 080 report/event tables and RPCs | **Redesign before implementation** | Migration 080 remains unapplied. Choose a new forward number only after authenticated current-ledger readback, then implement the accepted privacy, retention, evidence, transition and audit contracts below. |
| First-party `report_content` intent | **Preserve the intent; replace the contract** | Keep generic fail-closed errors, owned acting-persona validation, bounded input, deduplication and abuse limits, but resolve the owner decisions and visibility/evidence problems below first. |
| Staff list/resolve intent | **Preserve the intent; replace the contract** | Staff reads and mutations remain RPC-only and fresh-AAL2. A dedicated authority decision, minimized response, keyset queue and explicit transition/event model are required. |
| `content_report_events` append-only claim | **Reject as currently proven** | The branch logs status changes only and does not enforce immutability for privileged paths. Assignment, unassignment, note revision, evidence and any later action link need complete immutable events. |
| Report and event cascade deletion | **Reject pending retention decision** | Reporter or target deletion cannot silently erase safety evidence. Pseudonymization, tombstones, expiry, legal hold, export and erasure need an owner-approved contract. |
| SQL/runtime/verification harnesses | **Preserve test intent; rewrite later** | Reapply, role/RLS, two-owner, mutation and runtime coverage are valuable, but must target the redesigned current-numbered migration rather than migration 080. |
| CI job | **Defer until a current implementation exists** | The creative-library TCP-readiness repair is already on main and must not be ported again. A future moderation job must use the current shared harness and immutable actions. |
| ROADMAP and CHANGELOG edits | **Do not port** | They describe an old branch as ready and conflict with current release evidence. This design link is the only roadmap change in this slice. |
| AliaSpaces reporting client claims | **Separate repository and release authority** | No MyPersonas change deploys or accepts an AliaSpaces client. Both products need a versioned interface and independent exact-revision acceptance. |
| Immediate content enforcement | **Out of scope** | Recording, triage and resolution never delete, hide, unpublish, suspend or notify as a side effect. Enforcement needs its own exact target, authority, preview, evidence and approval path. |

PR #22 must remain preserved until a reviewed current-main record accounts for
every unique area. Merging this design later would still not make reporting or
moderation live.

## Trust and product boundaries

- A reporter is an authenticated account optionally acting through exactly one
  owned persona. The owner/persona binding is authoritative at the server.
- A report target is an exact first-party persona, post or comment. Provider
  posts, arbitrary URLs and uploaded evidence are not accepted through this
  generic target field.
- Report details, target snapshots and moderation notes are sensitive owner or
  safety data. They are never public persona content, model-training input,
  analytics copy, browser logs or notification text.
- A moderator has only the explicitly approved moderation authority. A platform
  title, technician role, service key or UI visibility must not silently confer
  that authority.
- MyPersonas and AliaSpaces retain separate source and release authority. Before
  implementation, the owner must decide which service owns the canonical report
  ledger and moderation policy; a transitional shared v0 file is not that decision.
- Report intake, review, content enforcement, account enforcement, provider
  actions and appeals are separate capabilities. No status transition may invoke
  another capability implicitly.

## Owner decisions required before implementation

These choices are intentionally unresolved. Source code must not invent them.

1. **Moderator authority:** dedicated moderator role, global administrator,
   technician or a reviewed combination; assignment authority may be narrower.
2. **Reporter identity:** whether staff need an account id, acting-persona id,
   pseudonymous stable reference, or no identity by default; define who can reveal
   a reporter and for which documented purpose.
3. **Reportability over time:** whether an owner may report after blocking,
   muting, visibility changes or target deletion, and how a formerly visible
   target is proven without creating an existence oracle.
4. **Evidence:** which immutable text/metadata snapshot or digest is required,
   whether harmful media is quarantined, and who can access it. Do not duplicate
   illegal or highly sensitive material into a generic event table.
5. **Retention and legal hold:** expiry periods, preservation triggers,
   pseudonymization, reporter/target/account deletion behavior, export scope and
   who can release a hold.
6. **Workflow:** exact allowed transitions, direct resolution, reassignment,
   clear-assignment behavior, reopen/appeal rules and terminal states.
7. **Duplicate reports:** return an existing id only, append new evidence under a
   separate bounded event, or allow a new report after a defined state/interval.
   A duplicate must never silently replace the reviewed reason or evidence.
8. **Cross-product contract:** canonical API owner, version negotiation, neutral
   unavailable behavior, UI wording and separate MyPersonas/AliaSpaces release
   evidence.
9. **Conflict and recusal:** which ownership, relationship, assignment or prior
   action conflicts require a moderator to be recused, who receives an escalated
   report, and whether any emergency override exists. An override must be narrow,
   independently reviewable and separately audited.

## Required report-intake contract

1. Direct table DML stays revoked for browser roles. A bounded security-definer
   RPC validates authentication, exact owner/persona binding and the current
   report policy with a fixed `search_path` and explicit grants.
2. Target kind, reason and optional details use allowlists plus UTF-8 byte limits.
   Oversize or malformed input is rejected, never silently truncated. Stored text
   is inert and escaped on every rendering surface.
3. Missing, invisible and unauthorized targets return one generic error. The
   check must follow the exact current viewer contract. Comment reportability
   follows the visible post/comment policy; a private, blocked or muted comment
   author must not make an otherwise visible comment uniquely unreportable.
4. Own-content and foreign acting-persona reports fail closed. Block/mute and
   delete races are serialized or compare-and-set against the same evidence
   revision used to accept the report.
5. Abuse limits use retained, race-safe account counters rather than a deletable
   row count. Limits cover account, acting persona, target and aggregate byte/row
   ceilings without leaking whether another person reported the target.
6. Deduplication is atomic and idempotent under an owner-approved rule. A retry
   returns the authoritative receipt; it does not rewrite reason, details,
   identity or evidence unless a separate bounded event is explicitly accepted.
7. Intake records an immutable server-authored target evidence reference: target
   kind, internal id, policy/revision, capture time, canonical content digest and
   bounded safe metadata needed for later review. Mutable live content is not the
   sole evidence source.
8. Intake creates no moderation, enforcement, provider, notification or
   publication side effect. `publishing_enabled=false` is not row-controlled.

## Required staff queue and mutation contract

- Every staff read and mutation requires fresh AAL2 plus the approved moderation
  authority. Browser roles have no direct report/event table access.
- The server applies the accepted conflict/recusal policy before listing evidence,
  assignment, note access or resolution. A moderator cannot review a report
  involving their own account, personas, content or prior action unless a narrowly
  approved emergency override is independently assigned and immutably recorded.
- Queue reads are bounded and stable-keyset paged using a deterministic time/id
  tie-breaker. Status, assignment and priority filters are allowlisted and capped;
  offsetless `ORDER BY created_at` alone is insufficient.
- Responses disclose only fields required for the current task. Reporter account
  and persona UUIDs, raw notes and sensitive evidence are withheld unless the
  accepted authority/purpose explicitly needs them.
- Assignment is an explicit tri-state operation: unchanged, assign exact eligible
  staff member, or clear. `coalesce(new_assignee, old_assignee)` is not an
  unassignment contract.
- Notes use bounded UTF-8 bytes and compare-and-set revision. Oversize notes are
  rejected. The event ledger records that a note revision occurred and its
  integrity metadata without copying unrestricted sensitive prose into every event.
- Every mutation is idempotent, exact-revision-bound and serialized with report,
  assignment and enforcement locks in one documented order.

### Transition decision

The owner must approve the final matrix. The conservative proposal for review is:

| From | Allowed proposal | Not implicit |
|---|---|---|
| `open` | `triaged`, `dismissed` | no direct content/account action |
| `triaged` | `actioned`, `dismissed` | no delete, hide, suspend or provider send |
| `actioned` / `dismissed` | terminal | reopen/appeal requires a separate reviewed RPC and event |

A same-state assignment or note update is not a status transition but still emits
its own immutable event. Direct `open` to `actioned`, terminal-state mutation and
triaged-to-triaged status events stay denied unless the owner explicitly changes
the approved matrix.

## Immutable event and evidence model

Before implementation, define event kinds for at least report creation, status
change, assignment, unassignment, note revision, evidence attachment, retention
action and a separately approved enforcement reference. Each event binds report,
actor or pseudonymous system principal, event kind, before/after revision,
server time and idempotency key. Sensitive values use minimized typed fields or
integrity digests rather than unrestricted duplicated JSON.

Append-only must be a database contract: browser DML is revoked, privileged
update/delete of event rows is denied or guarded, and retention/erasure uses an
explicit service path that leaves the required non-secret tombstone. A trigger
name or application convention alone is not proof. Reapply and role-switched
runtime tests must demonstrate that neither ordinary staff nor generic service
paths can rewrite history.

Evidence storage is encrypted, access-logged, size/type bounded and separated from
the public asset/CDN path. Active documents and arbitrary remote URLs are refused.
For dangerous material, preserve the minimum lawful evidence and use a reviewed
quarantine rather than copying bytes into notifications, exports or test fixtures.
Report text, notes and evidence are untrusted data and untrusted instructions. Any
future AI-assisted triage must isolate and delimit them, use a fixed reviewed task,
return suggestions only, and remain unable to assign, resolve, enforce or disclose
data. Prompt-injection and data-exfiltration tests are mandatory before such a
helper is even considered.

## Retention, export and erasure boundary

- Reporter deletion, target-persona deletion and account erasure must not cascade
  away unresolved safety evidence. Use owner-approved pseudonymization/tombstones
  and retention transitions instead of ordinary foreign-key cascade semantics.
- Define separate expiry for report content, staff notes, target evidence, immutable
  events and non-secret aggregate abuse counters. A legal hold is explicit,
  authorized, auditable and releasable; it is never inferred from status alone.
- Owner exports disclose the reporter's own submitted-report history only under the
  accepted privacy contract. Staff notes, other reporters, sealed evidence and
  internal abuse signals do not leak into ordinary owner/persona exports.
- Restore cannot recreate staff authority, legal holds, resolved enforcement,
  another account's report identity or sealed evidence capability.
- Erasure is dependency ordered and independently read back. If a retained safety
  tombstone is lawful/required, its fields and expiry are documented rather than
  described as full deletion.

## Cross-repository client contract

No AliaSpaces client code is part of this slice. A future client must call a
versioned first-party interface, present a neutral unavailable result when the
authoritative backend is absent, and never claim that a report was submitted until
the server returns a durable receipt. It must not cache private report details in
the public/offline shell or infer staff/enforcement state.

The MyPersonas backend, MyPersonas Pages and AliaSpaces client each need exact
source, package/deployment and signed-in acceptance evidence. One repository's
green test or installed Android build is not acceptance for another repository.

## Acceptance evidence required

- Current-number migration mirror parity, transaction/reapply coverage, grants,
  RLS and role-switched runtime tests.
- Two unrelated owners plus multiple personas under one owner; cross-owner,
  cross-persona and unrelated-staff reads/mutations fail closed.
- AAL1 denial and AAL2 acceptance for every staff operation; authority expiry,
  revocation, assignment eligibility, conflict/recusal and any reviewed emergency
  override are rechecked immediately before reads and mutations.
- Missing/private/draft/blocked/muted/deleted targets, visible-comment/private-
  author behavior, own content, stale evidence revision and target-delete races.
- UTF-8 byte caps, inert rendering, rate-limit races, duplicate concurrency,
  idempotent retry and aggregate quota retention.
- Stable keyset pagination, deterministic tie-breaks, bounded filters, explicit
  assignment clearing and every accepted/denied transition.
- Event immutability across browser, staff and generic service paths; complete
  assignment/note/status/evidence events without unrestricted sensitive copies.
- Reporter deletion, target deletion, expiry, legal hold, export, erasure and
  restore readback under the accepted privacy model.
- Proof that report resolution never mutates content/account/provider state.
- Synthetic-data canaries only until owner-approved retention and access controls
  pass; no real abusive or illegal material is required for acceptance.

## Ordered implementation and release gates

1. Owner records every decision listed above, including canonical product/service
   authority, conflict/recusal policy and the conservative transition matrix or an
   explicit replacement.
2. Security/privacy review accepts the threat, evidence, retention and cross-repo
   contracts.
3. Authenticated current migration-ledger readback selects a new forward migration;
   migration 080 is not reused merely because the old branch used that number.
4. A bounded backend/RPC slice and rewritten disposable runtime tests pass at one
   exact revision. No UI ships ahead of the authoritative contract.
5. The migration is owner-triggered through the reviewed ledger process, applied
   once, smoke-tested and read back. This document grants no production authority.
6. An exact-main backend artifact deploys before MyPersonas or AliaSpaces clients
   depend on it.
7. Owner MFA, two-account isolation, privacy, retention and synthetic report-to-
   resolution canaries pass with retained non-secret evidence.
8. Each client is separately packaged/deployed and signed-in tested against the
   exact interface version; offline/cache behavior is reviewed independently.
9. Post-release readback records revisions, feature state, roles and kill switches.
   Reporting remains disabled on clients until all applicable gates close.

Until these gates close, migration 080 remains unapplied, no reporting/staff queue
capability is live, no moderation decision is accepted, and PR #22 remains a
preserved review source rather than a merge candidate.

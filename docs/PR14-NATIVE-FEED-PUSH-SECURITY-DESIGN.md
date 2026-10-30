# PR14 native, feed and push extraction design

This is the current-main replacement for the **design intent** in open PR #14.
It is not an approval to merge that branch, apply a migration, request notification
permission, send a push, install an app or publish content. `publishing_enabled`
remains `false`.

PR #14 was useful as an early exploration, but its September source predates the
current owner-mutation, AAL2, release-ledger, package and mobile baselines. The
branch must be extracted by capability; it must not be merged or cherry-picked as
a unit.

## Extraction and supersession matrix

| PR #14 area | Current decision | Evidence or required replacement |
|---|---|---|
| Public sites/install help | **Superseded** | PR #37 (`a1a4e6e`) carries the bounded public checklist and Android-browser help with an explicit native-WebView exclusion. |
| Noo YouNiverse PWA copy | **Superseded; do not port** | Noo keeps its own canonical repository and deployment authority. The reviewed public mirror was reconciled separately through PR #30. |
| Android WebView and SDK 34 edits | **Superseded; do not port** | PR #34 (`ef8014a`) reconciled the retained code-2 source. The verified toolchain is Gradle 8.11.1, Android Gradle Plugin 8.10.1 and SDK/build-tools 36. |
| iOS WebView edits | **Do not bulk-port** | Current iOS source remains a local scaffold. A signed build, device behavior and App Store acceptance are separate work. |
| Debug APK collection script | **Reject as release evidence** | A package becomes a candidate only through a reviewed build with source revision, version, package id, signer, file hash and post-build readback. Collection is not installation or acceptance. |
| Migration 078 feed ledger and `#/feed` | **Redesign before implementation** | Use the feed boundary below and a new forward migration chosen from the current ledger at implementation time. Do not reuse the PR #14 SQL verbatim. |
| Migration 079 push ledger and `#/push` | **Redesign before implementation** | Treat subscription material as a server-held delivery capability, not ordinary browser-readable owner data. Use the push boundary below. |
| Expo shell | **Deferred by architecture decision** | Keep the proven platform WebView companions unless an approved native-only capability justifies a second client. Any future Expo client needs pinned versions, a lockfile and CI. |
| Feed/push UI wiring and fixtures | **Blocked on authoritative backend contracts** | UI may follow only after the schema, RPC, retention, export/erasure, threat model and release tests are accepted. |
| Migration 077 verification helper | **Superseded by current local source/tests** | Current migration 077 is local and unapplied; it and the owner-private draft suite are the comparison baseline only, not deployed authority. Do not replace them with the older helper or infer a live migration. |

Closing PR #14 later must cite the commits that implement or deliberately reject
each remaining row. This matrix alone does not close the PR or claim that feed or
push exists.

## Sourced private-feed boundary

### Assets and trust boundaries

- The signed-in owner configures a bounded policy for one owned persona.
- A server-side research worker performs retrieval. The browser never receives a
  provider secret or a general-purpose fetch capability.
- External pages, redirects, titles, snippets and model output are untrusted input.
- Stored feed items are owner-private research evidence. They are not AliaSpaces
  posts, provider drafts, approvals or social publication receipts.

### Required controls before schema or worker code lands

1. Every rule mutation and explicit research request requires a fresh AAL2 owner
   session. Direct authenticated table DML stays revoked; bounded owner RPCs use
   the repository's current lock order, compare-and-set revision and audit pattern.
2. Policy input is capped by rows and UTF-8 bytes: normalized unique host count,
   persona count, freshness, items/day, daily/lifetime spend and retention. A
   policy edit invalidates any prior exact review.
3. Retrieval is SSRF-resistant: HTTPS only; no credentials in URLs; no IP literals,
   loopback, link-local, private or metadata ranges. Resolve and validate every
   A/AAAA answer, bind the outbound connection to that validated resolution and
   reject any connection-time address drift. Reapply the same checks to every
   bounded redirect hop; ports, response bytes, time, redirects and MIME types are
   bounded.
4. Active content is never executed. HTML is parsed as untrusted text; scripts,
   forms, embedded credentials and instruction-like page text cannot override the
   system policy. Prompt-injection tests cover source and citation fields.
5. Evidence is normalized and immutable: canonical URL, final validated host,
   retrieval time, content hash, publisher/title, bounded supporting excerpt,
   freshness result, model/version and an idempotency key. Free-form JSON alone is
   not the authoritative citation record.
6. Only a service worker can insert research results. It rechecks current owner,
   persona, policy revision, budget and pause state before and after provider work.
   Known and ambiguous failures finalize exactly once and do not blind-retry.
7. Owner reads remain bounded/keyset-paged. Reject/archive/feedback operations are
   AAL2 RPCs, auditable and race-safe. Export, retention and erasure include both
   policy and evidence without exposing worker credentials or fetched raw pages.
8. `publishing_enabled=false` is enforced outside row-supplied booleans. Any future
   conversion to a draft starts a separate exact-preview/approval workflow and can
   never be an implicit side effect of research.

### Acceptance evidence

- Reapply and rollback-only SQL harnesses, grants/RLS inspection and migration
  mirror parity.
- Two unrelated owners plus two personas under one owner; cross-owner and
  cross-persona reads/mutations fail closed.
- SSRF/DNS-rebinding/redirect, oversize, MIME, prompt-injection, duplicate,
  stale-policy, quota and ambiguous-provider tests.
- Export, expiry and erasure readback with retained non-secret audit evidence.
- A synthetic-source canary before any owner-authorized external source test.

## Push-notification boundary

### Capability classification

A Web Push endpoint plus authentication material, an FCM registration token or an
APNs device token is a **delivery capability**. Browser clients may see only bounded
device metadata and state in ordinary UI/API reads and exports; they do not list raw
endpoints, auth secrets, provider keys or another device's token. Registration code
necessarily handles its own newly issued capability transiently, sends it once over
an authenticated TLS exchange and must not persist or echo it through an ordinary
read API. Server credentials remain in the approved secret store and never in
source, app bundles, exports, logs or screenshots.

### Required controls before registration or delivery lands

1. Delivery is globally and per-device off by default. Permission is requested only
   from a signed-in owner surface after an explicit gesture and plain-language
   explanation; the public/offline PWA shell never prompts.
2. Registration and revocation require fresh AAL2, CSRF/origin binding, exact owner
   and installation identity, a one-use challenge and a server-side capability
   exchange. Store encrypted/sealed capability material separately from browser-
   readable device labels, platform, created/last-seen time and enabled state.
3. Delivery accepts only the selected channel's approved push-service endpoint
   origins or an equivalently strict scheme/host/port allowlist. It follows no
   redirects, validates every resolved A/AAAA address, rejects loopback, private,
   link-local and metadata ranges, and binds the connection to that validated
   resolution so endpoint delivery cannot become an SSRF or DNS-rebinding path.
4. Define rotation, expiry, uninstall, logout, owner erasure and provider `404/410`
   cleanup before enabling delivery. Ambiguous outcomes retain a reconciliation
   state and cannot cause retry storms or duplicate notifications.
5. Delivery uses an event allowlist, idempotency key, daily/device/account caps,
   quiet hours and an owner timezone. A notification contains no draft body, chat
   text, fan content, private media URL, token or sensitive persona data. It may
   carry only a generic event type and an opaque route that reauthenticates in-app.
6. A service worker or native client validates the exact origin and route before
   navigation. Notification taps do not approve, publish, connect a provider or
   perform any mutation.
7. Service-side claims recheck current owner, device enabled state, global pause,
   event visibility and revocation immediately before delivery. Receipts retain
   bounded provider status and timestamps, never capability values.
8. Device inventory, notification preferences, receipts and capability erasure are
   included in the appropriate owner export/retention contract. Secret capability
   bytes are not exported or restored.

### Channel decision

Do not implement all three channels at once. After signed-in PWA/device acceptance,
choose one pilot:

- **Web Push** if installed-browser delivery is sufficient and the service-worker
  lifecycle is accepted on the target devices.
- **FCM/APNs through a native client** only if a documented native-only requirement
  justifies app signing, provider projects and store/device acceptance.

The first pilot must prove registration, delivery of a generic synthetic event,
tap-to-reauthenticate, rotation and revocation in a sandbox before production.

## Native-client decision record

The default is the current Android platform WebView and iOS WKWebView scaffold over
the real owner command center. They keep one authoritative UI/auth boundary and do
not pretend to work offline. Preserve the installed Android package and sandbox.

An Expo/React Native client is allowed only after an architecture decision names a
specific native-only need (for example, accepted camera/share, biometric unlock or
notification behavior) and shows why the current shells cannot meet it. Before
source is accepted it needs:

- one chosen client architecture rather than three drifting implementations;
- exact dependency versions, a committed lockfile, supported Node/Expo/React Native
  versions, immutable CI actions and dependency/license/audit checks;
- distinct development/production application ids and documented signing custody;
- the same exact-origin/route allowlist, system-browser escape and inert offline
  behavior as the current shells; no broad `data:`, `file:`, intent or arbitrary
  localhost navigation in a release build;
- deep-link/share input validation, planning-only share semantics and tests proving
  that a link or notification cannot mutate or publish;
- secure storage and logout/erasure behavior with no duplicated service-role or
  provider credential; and
- package, signer, version, device, accessibility, offline/reconnect and two-account
  acceptance evidence before any upgrade or store claim.

Wildcard dependencies and a missing lockfile are release blockers. A source shell,
debug package, simulator run or visible login is not installation or acceptance.

## Ordered release gates

1. Owner approves the feed policy/retention and the single push pilot/channel.
2. Security review accepts the threat model and current-numbered forward migration.
3. Local schema/reapply/rollback, frontend syntax, dependency and full regression
   suites pass at one exact revision.
4. The migration is applied only through the authenticated ledger process and read
   back; this document supplies no production authorization.
5. Exact-main backend artifacts deploy before any UI that depends on them.
6. Owner MFA/private canary and two-account isolation pass with synthetic data.
7. Pages or native candidate is packaged, identified and reviewed separately.
8. Real-device permission, offline/reconnect, rotation/revocation and accessibility
   acceptance pass before delivery is enabled.
9. Post-deploy readback records exact revisions and service state. Feed remains
   private; push remains generic; neither implies a provider/social send.

Until all applicable gates close, PR #14's feed, push and Expo source stays
unmerged and migrations 078/079 stay unapplied.

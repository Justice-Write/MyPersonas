# Domain release source/evidence handoff — November 2, 2026

Source owner: C:/mp-dialog-audit-30, codex/domain-reconciliation-20261102.
Release coordinator: MyPersonas portfolio stock-take,01a130c5-301b-7502-95de-3771c58ce49d.
AliaSpaces source/build owner:01a1290c-ed8c-7993-8b63-1868de298f68.
Owner's direct ruling: MyPersonas automation/persona management; AliaSpaces social.
Canonical dirty checkouts preserved. No independent merge/deployment in this lane.

Candidate includes main6b099fc, regressiondaacf6a, reconciled domain98ca542, host
identity/manifest/offline corrections and executable route tests. No082/reports.
The Pages allowlist includes domain-split.js; no test/docs/root handoffs are shipped.
Control manifest identity id/scope/start_url remains ./; social builder preserves it
while changing brand/categories/shortcuts and pinning its source artifact provenance.

## Backend evidence is not source-test evidence

Existing Pages gate requires successful manual supabase-deploy.yml on exact final
main SHA, image-caption-drafting scope, retained image-caption-backend-SHA artifact
whose file records sha, scope and functions=ai-proxy compose-post, then verified
private canary and migration/provider confirmations. New main SHA invalidates prior
backend SHA evidence. Source lane has not dispatched or verified that new backend.
Coordinator reports schema preflight in _ops/domain-split-20261102/backend-preflight.json;
this source lane has not independently read live DB or changed auth configuration.

Authentication redirect allowlist: management and social origins (including any
actually served www aliases) must be explicitly allowed for same-origin Google and
magic-link returns. Browser code uses location.origin+location.pathname. Sessions
remain origin-separated; no token or callback query is forwarded. Actual allowlist
and signed-in return readback are coordinator-owned and remain unverified here.

## Private image-caption canary, derived from current implementation

Source pointers: index.html requestRegisteredImageText/composerGenerateBriefFromImage/
composerGenerateImageText; image-caption-drafting.js requestPrecondition/verifyResponse;
compose-post/index.ts generateImageText and action=generate-image-text;
_shared/image-caption-drafting.ts resolveImageTextSource/runImageTextDraft;
ai-proxy/index.ts purpose=image_caption_draft.

1. With owner authentication/MFA completed directly, choose one owned, registered,
   approved-for-this-test nonpersonal image and private unscheduled source. Do not
   import personal media or alter provenance to make a test pass.
2. Record only nonsecret evidence of source type/id, revision, image asset id and
   immutable binding hash; verify source is not approved/queued/published.
3. A positive generate-image-text request invokes the persona's configured vision
   backend. There is no built-in no-paid positive dry-run. Use only a genuinely
   configured/approved no-charge backend or separately authorized generation spend.
   Do not equate invalid-request probes with this positive canary.
4. Verify nonempty suggestion with exact sourceType/sourceId/field/sourceRevision/
   imageAssetId/bindingHash and saved=false, approved=false. Suggestion appears only
   in the unsaved input; do not approve/publish or invoke provider sends.
5. Verify changed source/image/owner is rejected, existing draft/provider state is
   unchanged, and no suggestion from stale context is inserted. Preserve synthetic
   evidence without credentials/private screenshots.

No-paid bounded negatives: authenticated extra-key rejection, invalid/unowned source,
and stale binding rejection must stop before generation. Supplied captions to
ordinary action=compose bypass image analysis and insert a draft, so are NOT a
substitute canary. Tests use provider mocks; they do not satisfy positive live gate.

Readback dependencies: image source helper reads persona_media_assets, drafts,
post_drafts, persona_content_variants, persona_content_packages and personas.ai_backend.
Proxy additionally requires owned ai_backends, backend key/budget RPCs, persona
settings and provenance/storage binding. Existing migration metadata/permissions
must be read back, not inferred from ledger presence. Keep private owner/model
values out of the public evidence report. No new migration is introduced here.

## Candidate verification

963/963 Node tests PASS; all changed frontend script syntax and diff checks PASS. Six full-source-page headless Edge156 checks PASS with synthetic signed-out auth; 22 additional executable domain/metadata/workflow cases cover signed-in branches and MFA readiness with mocked data. Actual production auth/canary remains unverified. No backend/migration diff against6b099fc.

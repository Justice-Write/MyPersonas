# Website refresh, private media library, and OpenArt

Status: local implementation and isolated verification. Not merged, pushed, deployed, or authorized for production migration. No provider generation, OAuth change, purchase, or desktop installation was performed.

## Boundary checked before implementation

Read the Soul Concept Engine canonical handoff and inspected the preserved Persona Studio checkout at `C:/Users/Justice Right/.codex/worktrees/257b/soul-concept-engine` (branch `codex/persona-studio-preservation-20261001`, head `a8b26d2`). Its ADR-0026, studio README, and actual `apps/studio` sources establish a separate local authoring host with private previews, device pairing, portable packages and a model catalog. Its current `.persona` format excludes embedded media. Other engine worktrees exist; they were not merged or treated as one released product.

This supersedes treating MyPersonas's October 5 architecture plan as evidence that a second desktop studio needs to be built. Neither Soulular naming nor product ownership was changed.

| Responsibility | Owner |
|---|---|
| Original consent/accounting/provenance enforcement | Soul Concept Engine |
| Local assets, authoring, preview inference, model runtime, `.persona` packages | Existing Persona Studio implementation; product naming remains separate |
| Owner account, exact persona binding, external provider connection, generation receipts and review | MyPersonas |
| Public persona/social presentation | AliaSpaces |

The website only imports files explicitly selected by the owner. No loopback probing, desktop directory scan, implicit sync, `.persona` extraction, model downloads, training permission, or engine-certification claim was added.

## Implemented

- Refreshed signed-out landing, owner creative-home shortcuts, Create/Library/Review navigation, and phone-accessible entries. Existing social routes and account tools remain reachable.
- `#/library`: upload JPEG/PNG/WebP, MP4/WebM and supported audio up to 50 MiB; file header checks, SHA-256 deduplication per owner, source tool, project, persona, descriptions, notes, and new-version links. View private file copies on demand, edit descriptions, filter/search loaded items, paginate, and remove files/entries.
- One owner library across creative tools, not a multi-user shared folder. Source choices cover manual exports from Soul Concept/Persona Studio, DaVinci, Foxy, Higgsfield, Freebeat, OpenArt and other tools.
- `#/create`: OpenArt connection status/start/disconnect, project/model discovery, provider-schema-driven inputs, credit quote, exact explicit generation approval, durable job history, status refresh, and unused-quote discard. Submitted work is not represented as cancellable when the backend only supports discarding quotes.
- OpenArt project browsing and saving selected results as private metadata references. These remain provider-hosted; the UI distinguishes references from retained private file copies. Download at OpenArt and explicitly import to retain a copy. Hidden provider media is not displayed.
- Edits invalidate quotes, including edits while an estimate is in flight. Account/route changes invalidate asynchronous responses. A lost generation receipt is not automatically retried. The existing server claim/credit/owner checks remain authoritative.
- Private text-draft handoff carries an asset title/ID as owner guidance. It does **not** attach media or change the mobile milestone's prohibition on media plans. Approval remains a planning record; `publishing_enabled=false` is unchanged.
- OAuth completion has a return link to the creative workspace. Account erasure includes the new storage bucket; metadata cascades on owner deletion.

## Storage and deployment contract

Candidate `supabase/migrations/20261013155606_private_creative_media_library.sql` was created with the Supabase CLI. It adds `owner_media_library` and private `creative-private` storage, owner+AAL2 RLS, ownership-bound persona/version references, immutable media identity, and fixed unreviewed/no-training state. A restrictive bucket policy fences off legacy permissive policies. File replacement is prohibited; imports create a new version instead.

The frontend uses the signed-in client; no service-role credential is exposed. Private file previews are in-memory blob URLs revoked on workspace reset. The service-worker public allowlist is unchanged and excludes the workspace, API data and media. Provider URLs are restricted to the existing exact OpenArt CDN contract and are not fetched until explicitly opened.

Uploads and metadata are separate transactions. If metadata fails, the UI attempts to remove the uploaded copy and reports cleanup failure with its file ID. A sign-out/network interruption can leave an owner-private orphan; erasure removes the entire owner prefix. This is not a resumable large-video uploader. Header checks are client-side format screening, not a malware scanning or media-normalization guarantee.

Read-only production inspection confirmed the OpenArt job columns and existing quote/claim/status contracts. No credentials or private account content were requested. The current owner session's OpenArt grant and provider execution were not tested.

Before release: reconcile outstanding migration history; apply and verify this additive candidate only through a separately authorized release; verify the OpenArt functions and callback update; include `creative-private` cleanup in the delete-account release; test two unrelated owner accounts and actual storage with AAL2. The Pages artifact includes the three new frontend assets; test fixtures and SQL remain excluded. Existing release gates were not bypassed.

## Verification

- Full Node suite: 532 passed after adding eight creative-workspace tests.
- Frontend inline scripts and new standalone scripts parse successfully.
- Disposable PostgreSQL 16 migration apply/reapply passes role-switched checks for unrelated owners, foreign persona/parent binding, AAL1/anonymous refusal, URL constraints, immutable references, and restrictive storage policies in the presence of a deliberately permissive older policy.
- Isolated Electron browser test: public landing, connected fixture model form, quote without generation, quote invalidation, one explicit fixture dispatch, real browser File/FormData import and metadata hash, library detail, missing-schema state, and no horizontal overflow at 390px. All external network requests are blocked. This is not authenticated live-provider acceptance.
- Deno checks pass for changed `openart-connect` and `delete-account` entrypoints.

Commands: `npm test`; `node scripts/check-frontend-syntax.mjs`; `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-creative-library-sql.ps1`. Run `tests/creative-workspace.browser.cjs` with an existing Electron executable; no new runtime installation is required. SQL isolation is also added to CI using PowerShell on Ubuntu.

Ignored local evidence: `outputs/creative-node-test.log`, `outputs/creative-sql-test.log`, `outputs/creative-deno.log`, and `outputs/creative-refresh/` screenshots plus `browser-result.json`. Screenshot content is test fixtures, not the owner's media.

## Next

1. Approved release and actual-account acceptance of this slice, including low-cost generation only with specific spending authorization.
2. Higgsfield and Freebeat adapters using the same owner, quote, job, result/reference and review boundaries. Neither adapter is added here.
3. Explicit reviewed desktop-to-web transfer contract if desired. Do not turn the private desktop collection into an automatic cloud mirror.

References checked: [Supabase storage RLS](https://supabase.com/docs/guides/storage/security/access-control), [OpenArt MCP](https://openart.ai/mcp/). Supabase's October 12 TLS deprecation was checked; no legacy TLS client was introduced.

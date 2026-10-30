# Family private handoff — October 26, 2026

Status: reviewed and tested local source increment. Not pushed, merged, deployed or verified against an owner account. Training and publishing remain off. The October27 verification receipt records the local commit separately from release acceptance.

## Existing work reused

- Soulular 1.2.39 already exports individual media and portable identity packages. Its full identity packages can include references, metadata and LoRAs; they are **not** website media imports and are not uploaded by this change.
- MyPersonas already imports an explicitly selected finished media file into `creative-private`, checks storage rights, binds an owned persona and records no training permission. Desktop originals remain separate. Its Library already opens the existing four-channel text-draft modal.
- AliaSpaces already owns page presentation. MyPersonas remains the transitional host and deployment/migration authority. No parallel social publisher or desktop runtime is added.

## Implemented increment

The Library continuation now revalidates the original owner/workspace/route and currently open asset, exact owned persona, and saved description fields. Unsaved title, persona, project, description or notes block continuation. Starting another draft does not replace an already-open private draft.

The draft receives only reference title, library ID, tool label and description. It receives no media plan, desktop path, credentials, permission or approval. The existing draft/account-binding and exact-preview gates remain authoritative. An explicit page button navigates to the assigned owned persona's saved AliaSpaces handle, without publication or media attachment.

The UI calls the existing `soul_concept` source **Soulular / Soul Concept**. Stored enum values and existing records are preserved; no SQL migration is required.

## Verification and limits

October27 review: the original six-file increment was hash-snapshotted before review. A fresh complete Node run passed 533 tests with zero failures/skips; both changed frontend modules pass syntax checks and the working diff passes whitespace checks. Review rechecked exact owner/persona/route/open-asset binding, saved-field comparison, open-draft preservation, handle routing and reference-only guidance. This was a single-agent source review, not a new independent security review. Production code bytes are unchanged from the reviewed starting increment; only this status/documentation note changed. No live services, accounts, data, permissions or SQL migrations were touched.

- Full MyPersonas Node suite: 533 passed, zero failures/skips.
- Focused handoff/library suite: 14 passed, including changed owner/route/workspace, foreign/missing persona, unsaved fields, another open asset, open-draft preservation and hostile/missing handles.
- Frontend JavaScript syntax and `git diff --check` pass.
- Existing AliaSpaces main: 28 tests pass; boundary check passes 26 files. No AliaSpaces source changed.
- Actual browser synthetic fixture: Library, source label, continuation, unsaved-edit refusal, real production draft modal/reference guidance and read-only page-route request inspected.
- Owner sign-in, production storage/RPC, physical phone and installed desktop transfer were not exercised. A synthetic screenshot is not evidence of a live integration.

## Capture kit

Run `node scripts/serve-family-demo.mjs`, then open `http://127.0.0.1:8786/`. Only seven allowlisted fixture/assets are served on loopback; CSP blocks outbound connections, frames and form submissions. Demo data is in memory. No production client, token, account or owner media is used. The fixture uses production Library and draft components but cannot save a real draft.

Capture with the browser tool. Screenshots may be returned as JPEG bytes: retain the matching extension. Do not call a held screenshot or a sequence of screenshots a real-time screen recording.

The collected private editing kit is outside the source tree at:

`<private-evidence-directory>`

It contains six labeled synthetic screenshots, an 18-second handoff screen sequence, a seven-second refusal hold and an eight-second Soulular synthetic desktop hold. No narration, music, paid generation, upload or publication. Individual frames are retained for re-editing.

## Next integration work

1. Review this increment, then separately release the existing creative frontend through its signed-in canary and exact-main gates. Do not bypass the pending deployment prerequisites.
2. Verify selected Soulular output → private file import → exact owned persona → saved description → private text draft with two unrelated owner accounts, including session change and uncertain-write cases. Any live upload remains a separately scoped owner-data action.
3. Reverify public media opacity and reports/moderation contracts before expanding AliaSpaces publication. Review existing 080/081 and client branches; do not duplicate them or apply migrations here.
4. Full identity-package transfer, media attachments, training and publishing remain outside this increment. Complete schema/rights/preview acceptance before considering them.

## Educational and marketing edit backlog

| Video | Purpose / angle | Available footage | Claim boundary |
|---|---|---|---|
| One identity, three workspaces | Educational overview of Soulular, private MyPersonas and AliaSpaces | Soulular synthetic desktop + continuation card + draft | Architecture and local demonstration, not production end-to-end proof |
| From a finished asset to a private draft | Step-by-step tutorial | Library, saved continuation, draft reference | File import exists separately; this recording starts with an in-memory fixture asset |
| Save before you switch | Educational data-preservation lesson | Unsaved-change refusal + saved draft | Shows a tested local guard; no live owner-data migration |
| Keep creative work in character | MyPersonas product introduction | Library and four-channel draft | Label development preview; simulated account state, no publishing claim |
| A unified desktop for your characters | Soulular product introduction | October25 synthetic 1.2.39 desktop/paired-phone evidence | Desktop installed separately; paired phone is browser QA, not physical-device acceptance |
| Your public persona has its own space | AliaSpaces product introduction | Existing October26 public web screenshot and October16 Android introduction | Date-stamp footage; no claim of current signed-in phone/privacy acceptance |

Keep obsolete Song artwork, private reference galleries, real account bindings, identifiers, pairing codes and secrets out of this kit. Scripts/edits and any public release need their own review; collecting footage authorizes no publication.

## October 28 session-safety follow-up

The initial six-file handoff increment is committed as `39e897a`. A follow-up fixes an expired/signed-out session click that previously rejected before the UI error handler: it now displays the sign-in/security refusal without running the requested action. Added regression coverage also proves private storage paths, provider URLs, bytes and credentials do not enter the reference handoff.

Verification: full Node suite 535/535 passed (zero skips/failures); focused handoff rerun 8/8 passed; JavaScript syntax and diff checks passed. The synthetic fixture adds explicit expire/restore session controls for footage. No real accounts, RPC saves, media uploads, training or publishing were exercised. Real two-account and physical-device acceptance remain pending.

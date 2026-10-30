# Create and review a private four-channel kit

Source-checked against MyPersonas main `813126414fa7554e78f38f6944014b011f5c84cc`,
October 24, 2026. This walkthrough covers the owner command center's **private
four-channel workflow**, not the separate legacy publishing queue. Availability on
your website or phone also depends on the matching deployed UI, signed-in backend
and reviewed migrations; this guide is not a live or device acceptance receipt.

`publishing_enabled=false` is permanent in this workflow. Saving creates a private
draft. Approval records your review. Manual scheduling records a plan. None sends
anything to a social network or website.

## Before writing

1. Sign in to the owner command center at `#/owner` while connected. The public
   offline shell and disconnected Android WebView cannot create or approve drafts.
   Exact approval and manual scheduling also require an MFA-verified owner session
   (AAL2). Complete any requested MFA step yourself in the site's authentication
   screen; never send codes or recovery secrets in chat.
2. Select the intended persona from your owned roster **before** opening the form.
   Check its name. A backup group does not grant access to somebody else's persona.
3. Choose **New private draft**. The sheet is titled **Write a four-channel kit**.
   Check the displayed account for X, Instagram, Facebook and Website. Each channel
   must have exactly one eligible, non-suspended account assigned to this owner and
   persona for the matching provider. Suspended or foreign rows cannot supply that
   binding and are ignored; zero or multiple eligible assignments block saving.
   This form shows account bindings; it does not contain an account-picker dropdown.
   Stop and check the exact account-ledger assignment in **Matrix → Accounts**
   (the source's account-record entry point), or ask the site technician. Then reopen
   the draft and check the bindings. This guide does not cover the separate assignment
   changes or establish that those records are OAuth-authenticated. Do not guess a target,
   remove legitimate accounts merely to bypass the check, or enter credentials here.

Save text you intend to keep, then close the form before switching personas; you
can instead close and discard unsaved text. The open draft's Save button
retains the persona selected when the form opened; switching the page selector does
not retarget that draft. Closing or cancelling a form does not autosave its text,
and this guide does not promise an unsaved-changes confirmation on close.

## Write and save once

Choose a **Package title**, optional **Owner guidance**, and fill all four body fields.
Leaving the title blank uses the default **Mobile private draft**; the four bodies
are required.
Owner guidance is stored context, not a request that automatically calls an AI.

| New private-draft body | App character limit |
| --- | ---: |
| X | 280 |
| Instagram | 5,000 |
| Facebook | 10,000 |
| Website | 30,000 |

These are this composer/helper's limits, not verified current provider limits or
the limits of every other editor. Each body must contain text. Title is bounded to
300 characters and guidance to 6,000; the server also validates size and quotas.
This initial form is text-only: it creates empty media plans, not photo uploads,
image generation, image captions or automatic posts. Existing content kits may
have media; that separate editing workflow does not turn this form into an uploader.

Click **Save private draft for review** once and wait. On a reported successful
save the sheet closes, owner data reloads and the app opens the kit in
`#/schedule/<package-id>`. Check the persona, saved text and **Needs review** status.
**Review queue**, **Review posts** and **Open queue** lead to this Post schedule
area; the relevant section is **Content kits**, not the legacy three-channel queue.

If saving is unavailable, stop at the reported error. The source requires the
reviewed prerequisites for migrations 054, 073 and 077; their presence in Git does
not prove they were applied to the linked backend. An owner/technician must check
the actual release ledger. Do not paste or run SQL to bypass an unavailable RPC.

## Review saved text and approve its exact preview

1. Open **Review & edit** on the saved kit. Check every channel's text, title and
   guidance. An **Image selected** indicator may appear, but the editor is not the
   full asset/media-plan preview; inspect those in step 4. Edit as needed, then click
   **Save changes**. This saves,
   reloads and reopens the kit. Material edits clear prior approval and remove the
   kit from the manual schedule; re-review is required. Content, media, targets and
   timing can invalidate the exact evidence; after a change, check the saved status
   rather than assuming old approval remains valid.
2. Do not approve unsaved text. Saved-kit actions show **Save and reload** guidance
   while edits are dirty; copying, opening a portal, approval and scheduling use
   saved bytes, not whatever is still in an unsaved textbox.
3. Close the reopened editor to return to the kit card. Check **Proposed manual-work
   time** and its displayed timezone.
   Pick a future time even if you only want to approve now. This proposed time is
   included in the approval preview; it is not a command to publish at that time.
4. Choose **Preview & approve exact kit**, or **Preview saved kit & approve** in
   the editor. Review all four server-bound cards: X, Instagram, Facebook and
   Website, exact targets, saved copy, any media plan, accessibility text and time.
   Follow the preview dialog's review acknowledgement and media-readiness checks.
   Only confirm with **Approve exact four-card preview** when satisfied.
5. Successful approval changes the kit to **Approved**. Approval does not schedule
   or publish. The source receipt expires after five minutes and is session-bound
   and single-use. Expired, changed or rejected evidence needs a fresh preview,
   not a reused receipt or a forced status change.

To make a manual plan **after** approval, choose **Preview & place on schedule**,
check the proposed time and all four targets again, then confirm **Approve previews
& place on manual schedule**. The result is **Manual schedule**, not a provider
queue or a post. **Unschedule** clears approval and returns the kit to owner review.
Provider handoff/posting is separate and is not part of this walkthrough.

## Errors, rejection and preservation

- An error, timeout, lost connection or closed dialog is **not proof that no write
  occurred**. Creation has no documented idempotency/retry token. Do not double-click
  Save or automatically repeat creation, acknowledgement or approval after an
  uncertain response. Preserve unsaved text in an owner-controlled private location
  if needed, reconnect/reload Post schedule, select the exact persona and inspect
  the persisted kit, body and status before deciding whether anything remains to do.
  Reopen a fresh preview only when a further action is actually needed. If the
  saved result cannot be reconciled, stop and ask the site technician; do not assume
  an exactly-once or automatic recovery guarantee.
- **Reject draft** asks to delete the owner-review draft and warns that this cannot
  be undone. It removes the private draft; it is not a reversible hide button or a
  provider deletion. Use **Cancel** or **Close** if you only want to leave a form.
- **More → Export / import prefs** transfers the selected-persona helper and bounded
  draft-ID references, not draft bodies, media, secrets or authentication. It is
  not a draft backup, account transfer or offline authoring system. Import does not
  change ownership or grant provider access.
- If the signed-in account or persona is not the one intended, stop. Do not use
  another account's IDs, bypass ownership checks, change OAuth scopes, put secrets
  into chat, or activate a publishing path to make this private workflow work.

## Source and remaining acceptance

The steps follow `owner-app.js` (private composer, kit editor and preview handlers),
`mobile-owner-workflow.js`, and the 073 exact-preview / 077 private-draft SQL source.
The [command-center contract](OWNER-MOBILE-COMMAND-CENTER.md) covers the larger
architecture. Local source-parity and synthetic helper tests are not proof of
applied migrations, real account bindings, privacy isolation, timeout recovery or
physical-phone behavior. Signed-in two-account and device acceptance remain separate
release gates; this documentation change neither runs them nor authorizes them.

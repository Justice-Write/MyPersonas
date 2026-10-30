# Synthetic browser qualification — 2026-10-30

PR47's three browser flows are partially testable without an account or foreground
desktop lease. `scripts/qualify-dialog-browser.mjs` ran against installed Edge
156.0.4314.50 in a fresh headless context. All requests were fulfilled locally;
the callback fetch was mocked. No personal profile, clipboard read/write, OS mail
handler, provider account, backend or release was touched.

Run with Node, passing the installed Playwright `index.mjs` and browser executable
as two arguments. No repository dependency or shipped package is added. The script
closes its browser in `finally`. Its synthetic origin is `https://fixture.invalid`.
Popup blocking is not disabled by Playwright's usual launch flag.

## Nine passing checks

- The actual shared destructive dialog focuses Cancel; Escape cancels with no popup.
- Clicking its OK button preserves user activation and opens a popup with no opener.
  The successful `window.open` returns null with `noopener,noreferrer`.
- The actual OpenRouter capture/return functions consume synthetic PKCE state and
  scrub the code from the URL. Accepted, blank and cancelled model prompts each
  trigger one mocked exchange, with the exact code/verifier/model payload.
- Expired state, mismatched initiating owner, replaced returned session and changed
  auth generation each prevent exchange (four separate cases).

These are headless browser observations, not physical-device or signed-in acceptance.

## Concrete technical remainder

1. **Mailbox:** the current `if(opened) ... else toast(blocked)` treats a successful
   noopener popup as failure. Preserve noopener; redesign feedback around what the
   browser can actually establish. The async target lookup must also be bound to
   the still-current account/finding/owner before showing the final destination.
   Test real destination confirmation and cancellation, then OS mail-handler launch
   without sending mail. A synthetic popup alone does not accept that full flow.
2. **OAuth:** Cancel currently means the same thing as an optional blank model and
   still exchanges the code. A replacement must explicitly resolve this contract:
   abort connection on Cancel versus retain optional-model skip behavior. This
   qualification records the current behavior without silently changing it. Same-
   browser synthetic PKCE/session tests now exist; real provider return acceptance
   remains separate.
3. **Clipboard:** `copyText` currently handles only fulfilled `writeText`, with no
   rejection/fallback handling. Exact packet/owner binding and recoverable copy
   failure need implementation and tests before conversion. No OS clipboard was
   accessed, so clipboard acceptance remains unclaimed.

The next foreground request should be bounded to a fresh, unsigned-in temporary
browser profile and local synthetic fixtures: clipboard preservation/restoration
including formats (or an isolated clipboard environment), HTTPS popup checks, and
mail-handler launch with a synthetic destination and no send. Actual Android
WebView and assistive-technology checks need their own device/scope. The released
desktop lease alone supplies none of these acceptance results.

All five native calls remain unchanged. This test-only continuation does not deploy,
install, modify permissions, or claim the full dialog roadmap is complete.

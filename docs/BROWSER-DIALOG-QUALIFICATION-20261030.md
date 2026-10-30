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

## Fixed behavior and verification

Nine isolated Edge checks pass: actual shared destructive dialog Cancel focus,
Escape cancellation, and OK-click activation for an opener-isolated popup; actual
OAuth callback accepted/blank/cancel, expired state, wrong owner, replaced session
and changed auth generation. Synthetic code/verifier/model payloads are exact.

OAuth Cancel now consumes only this pending attempt's PKCE/code, scrubs the callback
URL and returns before a second session lookup, provider exchange or backend reload.
Existing backend state stays unchanged. Explicitly accepting an empty model retains
the existing optional-model contract: connect now, then use Edit to add a model.

Successful noopener windows return null. Unsubscribe feedback now says the page
was requested and suggests checking popup settings if no tab appears; it no longer
asserts blocking. Owner, account, finding and view are rechecked before side effects.
Opener isolation is unchanged.

Clipboard failures now settle false with retry guidance, including denial,
cancellation, unavailable API and synchronous errors. Success settles true. Business
copy binds the exact reviewed packet and owner before invoking the clipboard.
No automatic fallback exposes or transmits the text.

Fifteen new injected-clipboard/popup/context Node regressions pass. Full local suite:
906/906. Nine isolated Edge checks pass; syntax/diff checks pass. No real clipboard,
profile, provider, backend or foreground UI was accessed.

## Remaining acceptance

Five native calls remain: these fixes do not replace their UI. Actual clipboard
permission/activation, OS mail-handler launch without sending, Android WebView,
assistive technology and signed-in provider return remain separate checks.
Foreground scope must be requested for a fresh unsigned-in temporary profile/local
fixture, with all clipboard formats preserved or an isolated clipboard environment.
No foreground scope was taken. Source is not deployed or installed; exact-source
backend evidence and private canary still precede production release.

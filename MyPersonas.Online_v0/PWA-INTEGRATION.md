# AliaSpaces PWA integration

The installable shell is complete and wired into `index.html`. The Pages artifact now
includes the manifest, worker, install helper, public `sites.html` availability checklist,
offline page, and curated root icon mirrors. This is **source state only** until the
owner reviews and merges it, the gated Pages workflow runs for the exact current revision,
and the live site is read back. It is not deployment or installation evidence.

## Integrated `index.html` contract

The current head contains this block; keep it intact during future head edits:

```diff
-<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
+<link rel="icon" type="image/x-icon" href="./favicon.ico" sizes="any">
+<link rel="icon" type="image/svg+xml" href="./icon.svg">
+<link rel="manifest" href="./manifest.webmanifest">
+<meta name="theme-color" content="#1877f2">
+<meta name="apple-mobile-web-app-capable" content="yes">
+<meta name="apple-mobile-web-app-title" content="AliaSpaces">
+<link rel="apple-touch-icon" sizes="180x180" href="./icon-180.png">
+<script src="./pwa.js" defer></script>
```

No body patch is needed. `pwa.js` registers `./service-worker.js` and progressively
adds an accessible **Install app** button to the existing header navigation only when
the browser supplies a real install prompt. When the app is not already standalone,
iPhone/iPad and Android also expose **Install help**: Share → Add to Home Screen on
Apple, or the browser menu → Install app / Add to Home screen on Android. The fallback
does not synthesize install success, post content, or request notification permission.
Android WebView user agents are excluded so the installed native companion does not
offer browser-install guidance inside its own shell.

`sites.html` is a public, no-index checklist. It links only to public web routes and
policies, identifies Noo YouNiverse as an independently released site, and states that
the Android companion is a separate owner-only release lane. It contains no repository
paths, private data, store link, or claim that a native app is publicly available.

All URLs are document-relative. Do not replace them with root-relative `/...` paths:
the relative form works both at `https://mypersonas.online/` and a GitHub Pages project
path such as `https://owner.github.io/MyPersonas/`.

The editable brand masters remain under `brand/app-icon/`. The six public files at the
site root must stay byte-identical to their corresponding masters. The Pages workflow
allowlists only those six mirrors, so concept art, previews, and brand notes do not enter
the deployed artifact.

## Cache and update contract

- The service worker caches only `offline.html`, the public `sites.html` checklist, the
  manifest/install helper, and public A-home icon files listed in `PUBLIC_SHELL_PATHS`.
- It never stores signed-in application HTML, runtime document responses, Supabase/API
  responses, uploaded media, or third-party requests. Every navigation stays
  network-first; a network failure shows the public offline page.
- There is no background sync, post queue, push subscription, or implied notification
  permission. Push remains a separate, unimplemented roadmap item.
- A new worker does not call `skipWaiting()`. It waits for existing AliaSpaces tabs to
  close, avoiding a mid-form code swap. The UI announces when an update is waiting.
- Whenever a cached file changes, bump `CACHE_NAME` in `service-worker.js`. Activation
  deletes only older caches beginning with `aliaspaces-public-shell-`.

## Local and release verification

1. Run `node --test tests/pwa-package.test.mjs` from the repository root.
2. Serve `MyPersonas.Online_v0` through localhost; service workers do not run from a
   `file:` URL.
3. Confirm the browser application panel reports the manifest, 192/512/maskable icons,
   start URL, `sites.html` shortcut, and service-worker scope under the actual hosted path.
4. Install the app, then take the network offline and navigate. The public offline page
   should appear, with no Supabase or authenticated responses in Cache Storage.
5. Restore the network and use **Try again**. Confirm sign-in and all private data are
   fetched fresh.
6. Change `CACHE_NAME` for an update test. Keep one installed tab open and confirm the
   waiting-update message appears; close all tabs, reopen, and confirm the new worker
   activates.

No production deployment, physical-device installation, notification permission, push
subscription, native-store submission, provider send, or private-data migration is part
of this package.

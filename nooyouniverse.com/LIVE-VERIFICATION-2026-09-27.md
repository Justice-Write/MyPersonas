# Live verification — 2026-09-27

Verifier: Claude (Cowork session). Method: real browser (Chrome), `fetch` with `cache: 'no-store'` against the production origin. This is a genuine external readback, not a sandbox probe.

**Why this record exists.** `nooyouniverse/docs/live-readback-20260927.json` records `403 / 17 bytes` for every URL. That file is *honest* — it reports what its environment saw — but that environment has blocked egress, so those 403s are the proxy, not the site. No true live readback existed before this one.

---

## Result: the site is healthy. PWA fully live.

| URL | Status | Bytes | Content-Type |
|---|---:|---:|---|
| `/` | 200 | 21,048 | text/html |
| `/log` | 200 | 31,911 | text/html |
| `/sources` | 200 | 15,172 | text/html |
| `/corrections` | 200 | 10,351 | text/html |
| `/manifest.webmanifest` | 200 | 1,967 | application/manifest+json |
| `/sw.js` | 200 | 4,812 | text/javascript |
| `/offline.html` | 200 | 1,674 | text/html |
| `/assets/icon-maskable-512.png` | 200 | 6,729 | image/png |
| `/nonexistent-route-test` | **404** | 1,767 | text/html |

`navigator.serviceWorker.getRegistrations()` → **1 active registration.**

**The PWA defect reported on 2026-09-25 is closed.** The manifest and service worker that all five pages had been referencing since the favicon release now exist, deploy, and serve with correct content types. The site is installable on Android via Chrome → ⋮ → *Install app*.

## Security headers are live and correct

```
content-security-policy: default-src 'self'; base-uri 'self'; form-action 'self';
  frame-ancestors 'none'; object-src 'none'; img-src 'self' data:;
  script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://nwsqyuucwzihruszocge.supabase.co https://cloudflareinsights.com;
  font-src 'self'; upgrade-insecure-requests
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: no-referrer
permissions-policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
```

Note the `connect-src` correctly allow-lists the Supabase origin. That is the detail a CSP rollout most often gets wrong — it would have silently killed the waitlist. It was got right.

## Waitlist: WORKING — end-to-end, verified today

`POST /rest/v1/noo_waitlist` with the real contract → **201 Created.**

### Correction: I raised a false alarm during this check

My first two probes returned `401 — new row violates row-level security policy`, and I initially read that as the waitlist being broken. **That was my error.** Migration `061-security-advisor-safe-hardening.sql` tightened the insert contract to require, in both the RLS `WITH CHECK` and a table constraint:

- `email = lower(btrim(email))`
- `char_length(email) between 3 and 254`
- email matches the address pattern
- **`source = 'nooyouniverse.com'`**

My probes sent `source: "csp-check"` and `source: "health-check"`. The policy was correctly rejecting *me*. Re-running with the exact contract the live form sends returned 201.

Recording this rather than quietly deleting it, because a project whose charter promises corrections at equal visibility should not make an exception for its own verifier.

**Implication for future work:** the insert contract is now strict. Any client, test harness or future app that posts to this table must send `source` exactly as `nooyouniverse.com` and a lowercase, trimmed email. The live `index.html` already does both (`.trim().toLowerCase()`).

## Cleanup list grew to 3 test rows

Delete in Supabase → Table Editor → `noo_waitlist`:

1. `deploy-test-2026-08-09@nooyouniverse.com`
2. one `verify-…@example.com`
3. **`waitlist-health-check-20260927@example.com`** ← created by this verification

## Not verified here

- Mobile/native APK behaviour and any physical-device claim — different workstream, no device access from this session.
- `/mobile/web/index.html` appears in Codex's readback targets but is not currently served; Cloudflare serves only `public/`.
- Cloudflare auto-build hook — still unconfirmed; requires a signed-in dashboard session.

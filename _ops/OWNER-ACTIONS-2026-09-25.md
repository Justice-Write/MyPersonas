# Owner actions — 2026-09-25

Everything below needs your machine or your credentials. The sandbox has no GitHub push credentials, no Android SDK, and no `adb`.

---

## 1. Push (2 local commits waiting)

| Repo | Commit | Contains |
|---|---|---|
| `GitHub/nooyouniverse` | `fda6592` | PWA: manifest, service worker, offline page |
| `GitHub/MyPersonas` | `f8d47a9` | Same PWA files in source + source-of-truth reconciliation + roadmap update + deploy-script fix |

**`MyPersonas` is 13 commits behind `origin/main`, so rebase before pushing.** You also have unrelated uncommitted edits (`.github/workflows/*`, `MyPersonas.Online_v0/*`) — I deliberately left those alone, so stash them across the rebase.

```powershell
cd "$HOME\Documents\GitHub\nooyouniverse"
git push

cd "$HOME\Documents\GitHub\MyPersonas"
git stash push -u -m "owner wip 2026-09-25"
git pull --rebase
git push
git stash pop
```

Conflict risk is low — my changes are confined to `nooyouniverse.com/` and `_ops/deploy-nooyouniverse.ps1`, and the 13 upstream commits mostly touch `MyPersonas.Online_v0/` and workflows.

---

## 2. The Cloudflare build will probably NOT fire on its own

Pushing `fda6592` should deploy the PWA. Based on the last two releases it likely won't without a nudge. Check:

<https://dash.cloudflare.com/?to=/:account/workers/services/view/nooyouniverse/production/deployments>

If no build appears within a few minutes, trigger it manually — and while you're in there, please fix the root cause (§3).

**Verify after deploy:**

```
https://nooyouniverse.com/manifest.webmanifest   → 200, valid JSON
https://nooyouniverse.com/sw.js                  → 200
https://nooyouniverse.com/offline.html           → 200
```

Then on desktop Chrome: DevTools → Application → Manifest (no errors) and Service Workers (activated).

---

## 3. Fix the auto-build hook — needs you signed in

Confirmed broken twice: 2026-08-26 needed a manual invocation, 2026-09-18 needed a committed dummy file (`public/.deploy-poke`). My session couldn't check because your Cloudflare login had expired.

Check in this order:

1. **Worker → Settings → Build** — is a Git trigger actually configured? Is the branch `main`? Are there **build watch paths** filtering out ordinary content changes? My leading hypothesis: the trigger never properly established, because the original connection failed against an empty repo and the first successful build came from a manual *Retry*.
2. **GitHub → Settings → Applications → Cloudflare Workers & Pages** — does it still have access to `castleism/nooyouniverse`?

Once fixed, make a trivial real content change, push, and confirm a build starts **without** touching `.deploy-poke`. Then delete `.deploy-poke` and note it in the roadmap.

**Until then `.deploy-poke` is load-bearing — do not delete it.**

---

## 4. Installing on the phone

### The website — no APK needed

Once §2 is deployed, `nooyouniverse.com` is a real installable PWA. On the Galaxy Note20 Ultra:

> Chrome → open **nooyouniverse.com** → ⋮ menu → **Add to Home screen** / **Install app**

It installs standalone (no browser chrome), keeps the indigo theme colour, has a maskable icon, offers long-press shortcuts to Mission Log / Sources / Corrections, and works offline for pages already visited.

This is a **better** result than the WebView test APK for a website: it updates itself on every deploy, needs no sideloading, and no signing keys.

`mypersonas.online` already ships a manifest and is installable the same way.

### The 12 test APKs — already built and installed

Per `mobile-publishing-2026-09-20/ACTIVE-12.md`, twelve offline test APKs were built, signed, verified and **installed on the connected Galaxy Note20 Ultra on 2026-09-20**, with the ZIP also placed in the phone's Downloads folder. That includes `noo-you-test.apk`. Manual touch/visual acceptance was still pending because the phone was locked.

**I did not rebuild or reinstall them**, for three reasons: the work is already done; `build-apks.py` is a Windows script requiring the Android SDK at `~/AppData/Local/Android/Sdk` with `build-tools/35.0.0`, which the Linux sandbox does not have; and installing needs `adb` with the phone attached, which the sandbox also does not have.

To rebuild and reinstall yourself:

```powershell
cd "$HOME\Documents\GitHub\mobile-publishing-2026-09-20\android-test-lab"
python build-apks.py
adb devices                       # confirm the Note20 is listed and authorised
adb install -r apks\noo-you-test.apk
```

Unlock the phone first or `adb install` will fail silently on some builds.

**Worth knowing:** those APKs are explicitly *"test slices, not completed service-connected products."* The Noo app proper is still specification-only — no code exists, and it is gated behind the health-claim approver decision.

---

## 5. Still blocked on a decision, not on work

1. **Name a human health-claim approver** (pharmacist minimum). Open since August. Gates the evidence library, app Phase 2, and every compendium monograph.
2. **Rule on Mission 11** — it shipped outside the documented Package A queue, duplicates Mission 04, and is a fraction of the length of the other entries.
3. **Under-21 tier conflict** — tier engine allows private logging in Red; questionnaire spec stops under-21 before the health profile. Blocks app implementation.
4. Delete the 2 Supabase test rows in `noo_waitlist`.

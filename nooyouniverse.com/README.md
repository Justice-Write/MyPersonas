# Noo YouNiverse site source

This folder is the canonical source for [nooyouniverse.com](https://nooyouniverse.com). The public deployment is a Cloudflare Worker serving static assets from the separate `castleism/nooyouniverse` repository's `public/` directory.

## Current state

- Public Mission Log: 11 entries. Mission 11 is **Sleep before stack**.
- Legacy Package A: four unapproved drafts originally labeled 11–14; review them as proposed Missions 12–15 under `MISSION-LOG-RELEASE-QUEUE.md`.
- Revenue planning: proposed only; use `REVENUE-MODEL.md`.
- Detailed truth, gates, deployment history, and blockers: `SITE-ROADMAP.md`.
- Current work completed, evidence, backlog, and smallest owner actions: `ROADMAP-PROGRESS-2026-09-24.md`.

## Validate locally

From the MyPersonas repository root:

```powershell
node --test tests/noo-static-site.test.mjs
```

The test checks mission/source parity, assets, routes and fragments, canonicals and sitemap, disclosure boundaries, and the Cloudflare `_headers` contract.

## Preview and release boundary

The deployment helper is preview-first:

```powershell
.\_ops\deploy-nooyouniverse.ps1
```

Preview copies nothing and publishes nothing. Merge the exact source scope through the protected MyPersonas pull-request workflow first. From clean, current canonical `main` checkouts, `-Publish -Message "..."` performs an exact public-artifact sync, removes deploy-only leftovers, and commits and pushes only the deploy repository. That push may trigger Cloudflare; confirm the build and live readback because the hook has failed before. Planning documents in this folder must never enter the deploy artifact.

Keep these states distinct: drafted, approved, specialist-cleared, integrated locally, committed, pushed, deployed, and verified live.

# MyPersonas

Private automation and owner-control plane for persona operations. The current
public deployment is `https://mypersonas.online`.

AliaSpaces is the separate first-party social product. During the repository
split, some shared social UI and historical AliaSpaces naming still remain in
this repository; that transitional source must not be treated as permanent
product ownership. See [PROJECT-BOUNDARY.md](PROJECT-BOUNDARY.md).

## Versioned surface manuals — 2026-10-24

[Release/manual index](docs/SURFACE-RELEASE-AND-MANUAL-INDEX.md) separates production main 8131264 from desktop/mobile, remote/review, Fanvue and Instagram candidates. [Owner use/recovery/acceptance guide](docs/OWNER-USER-AND-ACCEPTANCE-GUIDE.md) covers actual identity, exact-preview and private-draft steps. The three-way persona-memory requirement is unimplemented; social/remote candidates remain inactive. No migration, credential, send, scope or tooling approval is supplied by these guides.
## Structure

- `MyPersonas.Online_v0/` — current transitional working tree (major version
  line v0), including the live owner control plane and shared legacy UI.
  The folder is renamed only on major version changes; point releases and
  hotfixes are git tags. See `MyPersonas.Online_v0/VERSIONING.md`.
- `.github/workflows/pages.yml` — deploys the current version folder to
  GitHub Pages only through its manual exact-main/canary confirmation gates. Bump `SITE_DIR` there on major
  version changes.
- `supabase/functions/mailbox-manager/` and `run-mailbox-jobs/` — the
  owner-authenticated Inbox Concierge control endpoint and its cron-secret worker.
  Gmail is the first real adapter; provider tokens and message references remain
  server-side, and every mailbox mutation requires an exact owner-approved plan.

## Development & CI/CD

- `npm test` — unit tests for pure helpers (`tests/`). Runs in CI.
- `node scripts/check-frontend-syntax.mjs` — parse-check the single-file app.
- `.github/workflows/ci.yml` — tests + `deno check` on all edge functions +
  frontend syntax on every PR/push.
- `.github/workflows/supabase-deploy.yml` — deploys edge functions only through its current manual gated workflow (owner-managed secrets). See `CI-CD-SETUP.md` and the workflow itself; this guide does not initiate it.

## Key docs

- `MyPersonas.Online_v0/ARCHITECTURE-REVIEW.md` — retrospective + prioritized
  refactor backlog (P0–P3).
- `MyPersonas.Online_v0/CONNECTOR-CORE-DESIGN.md` — plan to de-duplicate the
  five OAuth connectors.
- `MyPersonas.Online_v0/KEY-ROTATION.md` — migrating off deprecated Supabase keys.
- `CI-CD-SETUP.md` — one-time CI/CD setup.
- `MyPersonas.Online_v0/ROADMAP.md` / `CHANGELOG.md` — status of record.

## Deployment

GitHub Pages must be set to **Settings → Pages → Source: GitHub Actions**
(not "Deploy from a branch") for this layout to serve correctly.

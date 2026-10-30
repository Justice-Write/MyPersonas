# Workroom dependency validation — 2026-10-24

Candidate base: MyPersonas main `813126414fa7554e78f38f6944014b011f5c84cc`.

Electron is pinned from 44.7.0 to 44.9.3; the lockfile resolves undici 7.30.1 instead of 7.30.0. Both stay within existing major versions. Registry: https://registry.npmjs.org. Electron advisory: https://github.com/advisories/GHSA-jr5w-w6x2-84p9. Undici advisories: GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, GHSA-xjj6-f33q-929c.

Validation on Windows, Node 24.19.0, npm 11.17.0:

- Before: `npm audit --package-lock-only --json`: two high findings.
- `npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org`: completed with Electron binary download disabled.
- `npm run check` in apps/workroom-bridge: passed main.cjs and provider-policy.cjs syntax.
- `npm audit --audit-level=low --json`: zero vulnerabilities, including installed dependency tree.
- `npm ls electron undici`: electron 44.9.3, @electron/get 5.1.0, undici 7.30.1.
- Root `npm test`: 527 passed, zero failed/skipped.
- `node scripts/check-frontend-syntax.mjs`: passed, one inline script.

The bridge has no declared bundle/build command. This checks the source scaffold, not a packaged/native release. Electron's executable was absent after installation with scripts disabled. No running desktop app, profile, credential, provider transport, deployment or installed version was changed. Existing release and native acceptance gates remain.

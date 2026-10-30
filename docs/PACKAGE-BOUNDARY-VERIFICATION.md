# Package boundary verification

MyPersonas is the owner automation control plane. Its Android debug shell opens
the real owner workflow; the historical offline phone prototype is a separate
test package. AliaSpaces owns social presentation. Soulular owns desktop creative
work; Soul Concept Engine owns the consent/provenance layer. See
[PROJECT-BOUNDARY.md](../PROJECT-BOUNDARY.md).

## What belongs in a distributable

| Category | Install/public package | Separate state and verification |
|---|---|---|
| Web/Android application code, icons, reviewed dependencies | Yes, from the reviewed source and packaging rules | Bind commit, dependency versions and artifact hashes |
| Bundled media | Only when cleared for that destination | Existing source control is not proof of provenance, consent or current canon |
| Legacy ZIPs, installers, extensions | Separate payload review required | Inspect members, licenses and versions; never infer safety from the outer filename |
| Persona workspaces, conversations, private drafts and approvals | No | Owner-scoped data; backup/restore and account isolation are separate acceptance tests |
| Browser sessions, cookies, credentials and OAuth grants | No | Private per-user/per-account storage or server-side secret storage; never copy into artifacts |
| Reference photos, generated media, personal documents and exports | No, except individually approved public derivatives | Preserve originals and path/catalog relationships; use supported export/import |
| Model weights and private trained adapters | Not automatically | Explicit model installation, licensing, hashes, compatible runtime and hardware requirements |
| Build caches, local reports and backup archives | No | A backup is not a distributable; keep restore metadata with retained payloads |

An installation directory can contain both code and user-added references.
Copying an entire installed directory is not a valid packaging procedure. Likewise,
same bytes do not prove that a file is disposable: catalogs, hard links, backup
manifests and recovery paths can still depend on it.

## Generic package and content-pack target

Use three independently versioned layers:

- **Application:** code, manifests, reviewed dependencies, synthetic fixtures,
  icons and the minimum public shell assets. It must start without owner content.
- **Owner-authorized content pack:** persona definitions, canon, avatars, banners,
  launch material and other identity-bearing assets approved for one destination.
  Record provenance and approval per pack; do not silently bundle it into every
  installer.
- **Private runtime state:** accounts, sessions, drafts, receipts, chats, media,
  models, exports, caches and backups. Preserve and migrate through supported
  readers/exporters, never through an installer copy.

The ignored repository `outputs/` tree and installed creative-app reference
libraries are private working/runtime data. Tracked persona and launch media may be
intentional public content, but that does not make them a generic program
dependency. Negative-test or tampered packages are evidence only and must never be
promoted as release artifacts.

## Repeatable read-only check

Run from the repository root:

```sh
node scripts/audit-public-package.mjs MyPersonas.Online_v0 .github/workflows/pages.yml
node scripts/audit-public-package.mjs MyPersonas.Online_v0 .github/workflows/pages.yml PATH_TO_BUILT_ARTIFACT
node --test tests/public-package-audit.test.mjs
```

The tool reads the existing Pages rsync allowlist, hashes selected source files,
flags common private-store/key/model paths, and identifies bundled media and
archives for review. With a separately built artifact, it rejects extra files,
missing files and byte changes. Links are refused rather than followed into an
external personal directory. It never builds, uploads, installs, deletes or
changes deployment settings.

`SOURCE_INVENTORY_ONLY` means no artifact was checked. `BYTE_PARITY_ONLY` means
the supplied directory matches the selected source bytes. Neither result certifies
secret-free contents, archive contents, media consent, backend compatibility or
release readiness. Review the `reviewRequired` list even when the exit code is 0.
The denylist is a guardrail, not a substitute for content review. Run against a
stable reviewed checkout; concurrent file edits invalidate a snapshot.

## Recorded source baseline: October 29, 2026

At main `813126414fa7554e78f38f6944014b011f5c84cc`, the Pages rules select
81 files / 83,955,756 bytes. This includes a historical `Personas_v0.5.zip`
download and bundled persona/marketing imagery. They require their own review;
this inventory does not recertify them or change any publication decision.

## Exact-final-main package: October 30, 2026

The hardened candidate based on main `35ee29c102321c810d1e5c9a06a5fa12090fc9b8`
excludes `assets/personas/brother_karunya/***` because that identity is explicitly
retired. It also excludes the exact historical `Personas_v0.5.zip`; read-only
inspection found 17 source files, no executable members, and a separate Personas
desktop application lineage. Source history is retained. The private Pages artifact contains 122
allowlisted files / 79,613,797 bytes. Both verification commands report exact byte
parity with zero failures. The ZIP SHA-256 is
`bde2f4951f0e7e2a469301def8a659dfcc8c360b2fa74fd8d4a3ab1d1fb2fcc1`.
The audit still identifies 37 pre-existing images for separate
provenance and payload review. This is package evidence only: it is not a
deployment, installation, content-consent decision, secret-content certification,
backend acceptance or signed-in canary receipt.

## Remaining roadmap acceptance

1. Reconcile each feature branch against the intended product; preserve unique
   local work before consolidation. A clean feature branch is not deployed main.
2. Complete exact-main backend readback and the signed-in private canary required
   by the existing Pages workflow. Never substitute an older backend success.
3. Build using the existing allowlist and run the actual-directory check above;
   separately inspect bundled downloads and approved media provenance.
4. For Android, retain debug labeling and signing identity; verify the connected
   device, launch, sign-in, offline limitations and saved-data preservation.
5. For desktop upgrades, use the native application's reviewed payload verifier
   and fresh backup/restore checks. Do not wrap a personal data directory in an
   installer or infer a new installed version from a successful build.
6. Verify production asset hashes and device behavior after release. Keep source,
   CI, packaged, published and installed states separately recorded.

This change supplies a verification tool and documentation only. It does not
activate publishing, apply a migration, replace the existing release gates or
claim store readiness.

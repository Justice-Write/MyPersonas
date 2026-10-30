# Install package and personal-data boundary

## Purpose

This document separates files required to run MyPersonas from data created by or about the owner and other people. Installers, APKs, Pages artifacts, and public source releases must not quietly absorb personal working data.

## Package data

These items can be part of a build or deployable when their license and release gate allow it:

- application source and compiled code;
- static HTML, CSS, JavaScript, app icons, public branding, and offline limitations pages;
- empty database schemas, SQL migrations, validation rules, and typed API contracts;
- public documentation needed by an operator or app reviewer;
- empty templates, fixture data that is clearly synthetic, and deterministic test assets;
- version, build, dependency, license, and integrity manifests;
- endpoint hostnames and non-secret public configuration.

## Personal and private operational data

Keep these outside an install package and outside a public repository:

- email addresses, phone numbers, recovery data, authentication factors, device identifiers, and account ownership records;
- passwords, API keys, OAuth client secrets, access tokens, refresh tokens, cookies, signed sessions, and encryption keys;
- private drafts, approvals, scheduled content, unpublished posts, direct messages, inbox content, contact graphs, and moderation reports;
- private persona biographies, account ledgers, provider bindings, business records, analytics tied to an identifiable person, and audit logs containing content;
- unpublished Castleborn canon, character motives, manuscript material, story spoilers, and private character-laboratory observations;
- owner photographs, likeness references, voice samples, videos, raw generation inputs, training datasets, LoRAs, embeddings, model checkpoints, and private generated media;
- database dumps, storage-bucket exports, browser profiles, localStorage/IndexedDB, app data, crash dumps, caches containing content, and backups.

## Repository-specific findings

- The public Pages workflow builds an explicit allowlist from `MyPersonas.Online_v0`; it does not publish the whole repository.
- The Android companion packages source/resources only and connects to the live owner route. It does not package private drafts or OAuth credentials.
- `/outputs/`, `/_to_delete/`, root persona prompt/dossier files, Android build output, local SDK paths, and root `node_modules` are ignored.
- The repository currently tracks persona avatars, banners, and launch media. Treat these as public/product assets only if their provenance and publication approval are recorded. Otherwise move future private sources to protected storage and keep only reviewed derivatives in source control.
- Historical `tmp/` content is tracked in this repository. It includes owner-review documents and generated persona assets. It is not required for runtime and should be evaluated in a dedicated history/privacy cleanup, not silently copied into any installer or Pages artifact.
- Source code contains OAuth field names such as `access_token`, `refresh_token`, and `client_secret`; the bounded scan found no committed private key or literal named API-key assignment. This does not replace GitHub secret scanning or history scanning.

## Required packaging checks

Before release:

1. Generate a complete package file manifest.
2. Compare it with an explicit allowlist.
3. Reject `.env`, key/certificate files, databases, browser/app profiles, logs, backups, caches, and unreviewed media.
4. Scan source and package contents for credentials and high-risk personal identifiers.
5. Verify the package from a clean checkout.
6. Hash the final artifact and record the signer, package ID, version, source revision, and test evidence.
7. Install on a clean test profile/device and verify that no owner data appears before sign-in or import.

## Export and migration rule

Personal data should move through a separate, explicit export/import flow with versioning, access control, integrity checks, and a user-visible scope. Never use an application installer as a backup or migration container.


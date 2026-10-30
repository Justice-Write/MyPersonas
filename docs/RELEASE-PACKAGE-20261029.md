# MyPersonas release package — October 29, 2026

The release candidate is based on main `813126414fa7554e78f38f6944014b011f5c84cc` in an isolated checkout. The owner selected MyPersonas / AliaSpaces for release continuation. AliaSpaces/Akasha is being built separately in the existing roadmap/APK chat; this increment covers MyPersonas delivery verification.

## Completed source work

`scripts/verify-pages-package.mjs` verifies the actual Pages staging directory against the existing workflow allowlist. It refuses missing/extra files, symlinks, changed bytes and known private filenames, including environment files, databases, signing keys and private handoffs. Every accepted member receives a SHA-256 and size in the manifest. The workflow runs this check before uploading its artifact. This does not change deployment confirmations or enable provider publishing.

Six synthetic regression cases cover a valid exact payload, missing deny-all rule, extra handoff, altered program bytes, an included private database, and a missing asset. Full Node suite: 533 passed, no failures/skips. Frontend syntax validation passed. The independently staged website package has 81 members with exact-source hashes. Filename checks are not a content-level credential review or proof of account privacy.

## Actual deployment state

GitHub Pages is enabled at mypersonas.online. The latest successful recorded Pages workflow is run 35981622035, revision `acadc5decd4333b4258e86a91cc76c1836ef523c`, September 24. A successful backend run exists for current main: 38448350086. Run success alone does not prove the required image-caption scope receipt or signed-in private canary. No current deployment is claimed here.

The Pages workflow requires migration 060 and provider migrations 065–076 verified, an image-caption private canary, and a successful image-caption backend artifact bound to the exact main revision. It rechecks the backend workflow identity and current main before deployment. Do not supply confirmation strings from an assumed or stale record. Merging this verification increment creates a new SHA requiring its own exact-SHA release evidence.

## Runtime and personal data

The website package contains frontend code, public shell/icons and allowlisted public assets. It excludes SQL, developer tooling, tests, root handoff, outputs, Git history, credentials, local databases and private libraries. Authorized browser sessions and remote account/draft/media records are runtime data rather than installer contents. Preserve them during updates. The service worker caches only its explicit public shell; it does not store private workflow/API responses.

The Android owner shell is a distinct debug application, `online.mypersonas.owner.debug.local`, versionCode 1. It points to the real owner command center, and therefore does not make undeployed frontend features available. Its preference export is an origin preference, not an account or draft backup. Android automatic backup is disabled. Never uninstall an existing app to get around a signer mismatch; inspect device package/signing state first. No connected phone was available for this run.

Soulular desktop releases, model archives, persona libraries, training data and local media are separate products/data stores; they are not needed inside this website or thin Android shell package. Preserve them and their existing release ownership.

## Next release steps

1. Review and merge the verifier increment through its PR after CI.
2. Retrieve current migration and exact-main backend artifact evidence plus signed-in private canary evidence. Run only the approved deployment workflows once their factual prerequisites are satisfied.
3. Compare deployed assets with the release manifest and verify signed-in owner behavior.
4. Connect the phone; inspect existing package/version/signer, install the compatible APK, then check launch, sign-in and reconnect behavior. App installation is not provider posting permission.

Private local package manifests and build output live under the portfolio stock-take evidence directory. They are not uploaded into the public Pages payload.

Android build result: offline Gradle assembleDebug failed before compilation with java.io.IOException: Unable to establish loopback connection. No new APK or installed version is claimed. Website ZIP independent verification passed for 81 members; SHA-256 3d18c416d742bf98b92728371127ecd9ea2b58d50acd5852a0c63cf63b1ba915.


CI reconciliation: initial run41019471561 passed four checks and failed the pre-existing Workroom dependency audit. This release branch incorporates PR24 commit45d7fa5 (reviewed Electron/undici dependency fixes); its original PR remains open. Backend run38448350086 has zero retained artifacts, so a fresh exact-revision backend receipt is required before Pages.


Dependency follow-up: PR24 provided Electron44.9.3 / undici7.30.1. The present release additionally pins Electron44.10.0 for the advisory range observed in current CI. Fresh lockfile audit reports zero vulnerabilities; no Electron binary was installed.


## Final readback — October 29, 2026

PR27 merged as main35c6db9fd61d9f87b90eff9b0b25bb168bfc815d. All five PR checks passed. Main CI41020175200 initially hit a PostgreSQL startup race before SQL execution; its failed-job rerun passed. Local full suite533passed, no failures/skips; current Workroom lockfile audit zero vulnerabilities.

Android offline packaging SUCCEEDED (34tasks) after setting JAVA_TOOL_OPTIONS to short existing java.io.tmpdir and jdk.net.unixdomain.tmpdir directories. Initial failures are retained in private logs. Candidate APK SHA256a3842919112a733ac25c97fc9c7dd25d4daa79c92c024d2fb43e08712454906b: online.mypersonas.owner.debug.local, versionCode1,0.1.0-debug,targetSDK34. It was NOT installed because the authorized phone already has the SAME package at versionCode2,0.1.1-debug,targetSDK36,lastupdatedSeptember30. Preserve newer installation and data; reconcile its source before an upgrade. No downgrade/uninstall or private-account writes. The installed base APK was read back for program/signature verification, without reading app sandbox/user records.

Remaining: current exact-main backend artifact/private canary for production Pages and signed-in acceptance; canonical source reconciliation for the newer installed owner shell. Public website ZIP remains81exact-source files, private/local, not deployed. AliaSpaces/Akasha remains in its separate active release chat; Soulular/personal/model/media stores unchanged.

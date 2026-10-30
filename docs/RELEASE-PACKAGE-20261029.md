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


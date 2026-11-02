# PWA host identity follow-up — 2026-11-02

The live MyPersonas control site displayed an AliaSpaces waiting-update banner and install accessibility labels. The shared PWA helper now uses MyPersonas on the control hosts and AliaSpaces on the two social hosts. Local/unknown hosts default to MyPersonas, matching the source manifest. Install success, failure, help labels, update copy and registration warnings follow the same identity.

Only `MyPersonas.Online_v0/pwa.js` changes in the shipped application. Worker registration, scope, updateViaCache, install events, manual tab-close update behavior and private-data/cache boundaries remain unchanged. No service-worker or manifest identity changes are included.

## Validation

- Eight new event-driven VM tests exercise real PWA helper callbacks for canonical/www/control/social/local/lookalike hosts plus mobile help and failure paths. They also assert the nested worker URL, scope and update policy.
- Focused PWA suite:16 passed. Full Node suite:972 passed. Frontend syntax check passed.
- Production HTTP/browser readback is required after this follow-up is deployed; local tests do not substitute for that readback.

## Existing canary evidence and exact code comparison

Reference release: `95edd7fbdff684079d65784a77c8a3e30e33b4c2`. The coordinator's retained authenticated synthetic image-caption canary for that release passed positive binding, unsaved/unapproved flags and live stale-revision/absent-owned-source rejections. Its private receipt is not shipped here.

The following Git objects and paths are unchanged relative to that reference:

| Scope | Reference Git object |
|---|---|
| Entire `supabase` tree (all Edge functions, shared helpers, migrations and config) | `25886edf6dc318e00f7f56789e63dc33f47d5563` |
| Frontend `image-caption-drafting.js` helper | `89753db530961b87e6843bdb86b54c88c6ac7c3a` |
| Backend release workflow | `9361d5c68a56ed1a5146ce44d5e69081c1913955` |
| Pages release workflow | `d308eafbe4b46ca0d29a923cf454cc7b3a4ff7d5` |

The application index, owner-app, creative-media, creative-workspace and all other tracked shipped files also remain unchanged. Git-object comparison avoids Windows CRLF versus deployed LF ambiguity. Review the final candidate/merge diff and compare these objects again before release.

This supports carrying forward the prior **API canary evidence for identical code**, with its original reference SHA and explicit reused-not-rerun label. It does not create a new live canary result, establish new installed-app acceptance, or independently prove current provider availability. The PWA identity change needs fresh live browser verification on both sites.

The release coordinator must still obtain a successful backend workflow receipt for the new exact main SHA, read back identical deployed backend source, update the social site's source pin, and satisfy the unchanged Pages checks. No workflow guard, SHA equality requirement or canary confirmation was weakened. The coordinator owns merging and deployment; this source lane only prepares the PR.

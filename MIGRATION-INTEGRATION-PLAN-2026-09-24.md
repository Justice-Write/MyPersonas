# MyPersonas migration integration plan — 2026-09-24

**Status:** local integration plan only. Do not apply, rename, squash, or push a
migration from this document without an authenticated linked-ledger readback and
reviewed forward-only release.

## September 27 reconciliation checkpoint

Authenticated read-only inventory now records 68 applied versions, highest 20260905190142. Source and ledger hashes are recorded in docs/evidence/. There are 33 applied versions without matching local filenames; their full statement history and production-equivalent replay remain engineering work, not an authentication blocker. No remote migration or ledger repair was performed.

The two preserved local candidates were renumbered to logical 078 (backend URL edit) and 079 (unchanged media URL compatibility), with new forward timestamp mirrors after the observed remote head. The obsolete, unapplied compatibility timestamp was removed locally; its contents remain in Git history. Historical applied duplicates remain untouched. This resolves these two source numbering collisions; it does not resolve the whole migration ledger.

Disposable PostgreSQL 16 fixtures passed 078 apply/reapply, provenance 059→060→079 and reapply, persona-view 058 apply/reapply, and security-advisor 061 apply/reapply. These fixtures do not constitute production-equivalent schema replay. Live readback found the five-argument backend-edit RPC present and the mobile 077 private-draft RPC absent. Four local versions remain absent from the ledger (including 078/079 and mobile 077); do not blindly replay an already-equivalent YouTube migration.

The historical observations below describe September 24 and are superseded by this checkpoint where indicated.

## Why feature branches cannot be merged mechanically

Current `origin/main` uses logical migrations 063–077 for restore/AAL2,
mailbox-target protection, provider-preview gates, Discord, YouTube, TikTok,
CMS, Twitch/Patreon, immediate receipts, native publication, privilege
hardening, and the mobile private-draft workflow.

Older feature and integration branches assign different work to overlapping
numbers:

| Candidate logical numbers | Candidate work | Collision on current main |
|---|---|---|
| 062–064 | opaque public media, approved media, legacy remediation | 063–064 already mean restore/AAL2 and mailbox-target protection |
| 066–067 | custom fields, project resources | 066–067 already mean Discord and YouTube |
| 068 | account subscription entitlements | 068 already means TikTok connector foundation |
| 069 | operational alert inbox | 069 already means agent-draft preview gate |
| 070 | persona source library | 070 already means CMS draft connectors |

The preserved canonical checkout also has a separate untracked
`062-persona-media-unchanged-url-compatibility.sql`. It is not the same change
as the pushed opaque-media 062 and cannot claim that number.

The latest GitHub Supabase preview reports `Remote migration versions not found
in local migrations directory.` Migration 077 therefore exists in source but is
not proven applied. Local filenames alone are not the authority.

## Required forward-only procedure

1. Freeze production migration integration. Keep candidate branches and the
   dirty canonical checkout intact.
2. From an authenticated, read-only linked Supabase session, export the complete
   local-versus-remote migration list, including versions not present on main.
3. Record the highest remote version and the hash/name/purpose of each applied
   migration. Resolve drift before assigning any new version.
4. Split the old integration checkpoint by current product ownership:
   - AliaSpaces consumes opaque public-media and social-presentation contracts.
   - MyPersonas retains privileged approved-media processing, legacy cleanup,
     billing/entitlements, operational alerts, and private source libraries.
5. Rebase each feature independently on current `origin/main`, excluding its old
   migration mirrors. Do not merge the 30-commit checkpoint wholesale.
6. Assign new logical numbers after the confirmed canonical maximum and new
   timestamped filenames after the confirmed remote maximum. Preserve the SQL's
   semantic version metadata only after updating every test, manifest, workflow,
   and dependency reference consistently.
7. Verify each canonical SQL file is byte-identical to its timestamped mirror.
8. Run a disposable PostgreSQL chain from the current production-equivalent
   baseline through the new migration, including reapply, role-switched runtime,
   RLS, rollback-only probes, and cross-feature dependency tests.
9. Apply to a separate Supabase staging project first. Verify database,
   functions, signed-in frontend, two-account privacy, deletion/export, and
   operational alerts before requesting any production release.
10. Production remains a distinct owner-approved action with preflight readback,
    reviewed migration hash, exact function allowlist, Pages artifact, and
    post-deployment evidence.

## Integration sequence after ledger repair

1. Opaque media delivery and legacy remediation, because public rich media and
   entitlement-driven unpublication depend on it.
2. Custom field boxes and project-resource contracts assigned to AliaSpaces.
3. Shadow-only account subscriptions with checkout and enforcement disabled.
4. Operational alert inbox and retention/deletion reconciliation.
5. Private Persona Source Library.

Each slice must remain separately reviewable and default-off where it can spend
money, publish, expose public data, or contact a provider.

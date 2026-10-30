# PR8 canon supersession receipt — October 30, 2026

## Decision carried forward

This current-main source patch carries forward the owner decision recorded in
PR8 commit `56d7b7a56d4463e1f8780ff574bd0c8d0fe31569`:

- Akiko Sasaki (`@castleborn.akiko`) is the public Being Tea Co host.
- The former Brother Kāruṇya / `brother_karunya` identity is retired and must
  not be restored. It must not be used as a Being Tea Co host.
- Akiko's Castleborn family connections and family details remain
  private-by-default. The host decision is not permission to publish them.

## Exact current-main port

Base revision: `86051bb7d675946833b1ffa12544d3aba040d13d`.

- Removed only the `brother_karunya` object from
  `MyPersonas.Online_v0/content/persona-launch-pack-2026-08-01.json`.
- Updated the stable brand-manager and setup-conductor handoffs with the same
  public-host, retirement, no-restore, and family-privacy rules.
- Added a focused regression test that parses the launch pack and checks all
  four public decision surfaces for the exact decision.

The PR8 owner-phone launch pad, catalog, manifest, installation guide,
temporary review files, owner-local paths, and all other PR8 material were
deliberately not ported. They are not part of this supersession.

## Release boundary

This is a source/canon correction only. It does not delete a database persona,
change an account, publish or unpublish a profile, deploy a website, apply a
migration, install software, move personal data, or authorize public release of
Castleborn family information. Any runtime or provider cleanup requires its own
owner-approved, read-back-verified action.

## Local verification

- Full repository Node suite: 557/557 passed, with no failures, skips, or
  cancellations.
- Focused canon/privacy/package suite: 30/30 passed.
- Frontend syntax parser: one inline application script plus the tracked
  creative modules passed.
- Read-only Pages source inventory: 81 allowlisted members, zero failures;
  `SOURCE_INVENTORY_ONLY`, not an artifact, deployment, or content-consent
  review.
- `git diff --check` passed.

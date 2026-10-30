# MyPersonas surface release and manual index

This index maps stable ownership and operating boundaries. It intentionally does
not freeze a commit, workflow run, open-PR state or test count. A source branch,
passing check, package, deployment, installation and signed-in acceptance are
different evidence states.

For current facts, read the [project stocktake](PROJECT-STOCKTAKE-20261030.md),
[root handoff](../status-handoff.md) and the applicable repository/workflow record.
This index neither integrates candidates nor activates a feature.

## Product and surface map

| Surface | Source authority and manual | Boundary and acceptance gate |
|---|---|---|
| MyPersonas owner web | This repository; [owner use, recovery and acceptance](OWNER-USER-AND-ACCEPTANCE-GUIDE.md) and [private-draft walkthrough](../MyPersonas.Online_v0/OWNER-PRIVATE-DRAFT-GUIDE.md) | Private owner control plane. The live v0 site is transitional. Current main is not current production unless exact release evidence says so. |
| AliaSpaces | Separate product/repository; [project boundary](../PROJECT-BOUNDARY.md) | Public first-party social presentation. Shared v0 files do not transfer ownership, deployment authority or private automation secrets. |
| Android owner shell | `apps/personas-android/`; its README is the build/use manual | Thin debug WebView over `#/owner`, not a standalone publisher or Play release. Preserve the installed package/sandbox; any future upgrade needs exact package/version/signer and data-preserving acceptance. |
| iOS owner source | `apps/personas-ios/`; its README is the source manual | Source scaffold only. Native build, signing, device, accessibility and store acceptance remain separate. |
| Workroom desktop boundary | `apps/workroom-bridge/` | Per-account partition/source scaffold. A visible provider session is not a provider credential export, and source is not a packaged or accepted release. |
| Personas companion apps | Separate `Justice-Write/Personas` lineage | Separate application and state. Use explicit readers/migrations; do not copy its install or private data into a MyPersonas package. |
| Soul Concept / Soulular | Separate creative application and release lane | Reference media, generated media, models, adapters, history and training controls remain private state outside MyPersonas installers. |
| Soul Concept Engine | Separate consent/provenance repository | Related contracts and tooling, not MyPersonas deployment authority. |
| Castleborn / CREATE and persona-brand sites | Separate consumer/site authorities; see the [stocktake map](PROJECT-STOCKTAKE-20261030.md) | Canon, brand workspaces and identity assets are owner-authorized content, not generic installer members. Each site retains its own deploy gate. |
| Provider and review candidates | Current connector/roadmap source plus the root handoff and GitHub review record | Candidate code, fixtures, approvals and drafts are not provider acceptance. `publishing_enabled=false`; no social send is inferred. |
| Feed, push and alternative native-client proposals | [PR14 extraction/security design](PR14-NATIVE-FEED-PUSH-SECURITY-DESIGN.md) | PR14 is an exploratory source, not a merge candidate. Feed retrieval, push capabilities and Expo/native choices require the documented redesign and release evidence. |

## Evidence vocabulary

- **Source:** files exist at an exact revision.
- **Checked:** named tests or review passed for that revision.
- **Packaged:** an artifact was built and identified by hash/metadata.
- **Deployed:** the intended environment reports that exact revision/artifact.
- **Installed:** a named device/application reports the intended package/version/signer.
- **Accepted:** the required signed-in, cross-account, device and external-service
  behaviors passed with retained evidence.

Never collapse those states. The [package boundary guide](PACKAGE-BOUNDARY-VERIFICATION.md)
also separates the reusable application, optional owner-authorized content packs and
private runtime state.

## Memory requirement: specified, not implemented

The required future separation is approved public persona canon, owner-persona
private memory, and fan-persona private memory scoped to the exact fan/account
relationship. Each boundary needs its own approval, access, retention, export,
erasure and isolation evidence. Persona fields, source libraries, chat rows and
desktop history are not proof that this three-way contract exists. Cross-fan reuse,
training and automatic promotion of private memory to public canon remain prohibited.

## Release and external-action gates

Provider credentials stay server-side under exact owner/persona/provider/account
binding and never belong in examples, exports or screenshots. Planning approval is
not a provider send. The social and remote candidates remain inactive unless their
own exact release and acceptance evidence says otherwise.

Backend and Pages releases are owner-triggered and separately gated. They require
fresh authenticated ledger evidence, an exact-current backend artifact, owner
sign-in/MFA, the signed-in private canary, required environment review and exact
post-deploy readback. This index supplies none of those approvals.

No production migration, credential entry, OAuth scope change, account mutation,
real fan-data test, social send, device install, pairing, deployment or destructive
recovery action is performed by following this index.

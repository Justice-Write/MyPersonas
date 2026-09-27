# Deployed source reconciliation

Read-only recovery covered all 61 deployed function bundles. Ten newer entrypoints and eleven missing helpers were restored; ai-proxy v43 and delete-account v52 were reconciled with their own deployed entrypoints. Eight historical entrypoints are quarantined in supabase/recovered-legacy, outside deployment.

There are now 53 deployable local entrypoints. All pass Deno check. Five additional tests exercise research metadata normalization, local fleet stream validation, bounded developer proposals, OpenArt revoke failure handling, and erasure/fleet wiring. These fixture tests do not establish live provider readiness.

Some bundles embed older dependency variants. The developer-api variant of developer.ts supplies draft proposal validation; an older delete-account dependency embedded by erase-content was not used to overwrite the actual v52 entrypoint. Existing AAL2 enforcement was retained. No new MCP service, provider grant, or remote deployment was created.

Evidence in evidence/deployed-source-parity-2026-09-27.json records the PRE-recovery comparison, including missing paths at that time. Full bundle originals and sanitized profile packets stay in ignored outputs/. Inventory metadata and hashes are committed for reproducibility. A basic credential-pattern scan found no matches in recovered source; this is not a comprehensive secret or security audit.

Deployment workflow now requires main, production environment selection, tests, and bounded named-function release scope. The broad all-reviewed release option is removed. Repository environment protection configuration itself is not verified or changed.

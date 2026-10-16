# AI connector audit — 2026-10-16

Scope: hosted text-model connectors in `supabase/functions/_shared/ai-provider-endpoint.ts`
and the owner catalog `AI_PROVIDERS` in `MyPersonas.Online_v0/index.html`.
Drift between the two is now enforced by `tests/ai-provider-catalog-drift.test.mjs`.

Model IDs below were checked against vendor documentation on 2026-09-30. They are
hints only; the owner form now loads the live list from each provider through the
new `ai-models` edge function, so stale hints no longer block anyone.

| Provider | Host (policy) | Chat path | Model list path | Auth header | Current hint | Notes |
|---|---|---|---|---|---|---|
| OpenRouter | openrouter.ai | /api/v1/chat/completions | /api/v1/models | Bearer | anthropic/claude-sonnet-5-5 | OAuth PKCE also supported in UI. |
| OpenAI | api.openai.com | /v1/chat/completions | /v1/models | Bearer | gpt-6.1-sol, gpt-5.6-terra | Chat Completions remains maintained for gpt-6 family; Responses-only features are not used. |
| Anthropic | api.anthropic.com | /v1/messages | /v1/models | x-api-key + anthropic-version | claude-sonnet-5-5 | **No `-latest` aliases for 4.6+/5.x** — the dateless id is the pinned snapshot. |
| xAI (Grok) | api.x.ai | /v1/chat/completions | /v1/models | Bearer | grok-4.7 | 500k context. Aliases `<name>`, `<name>-latest`, `<name>-<date>`. Grok Imagine image/video and Voice are separate APIs, not wired. |
| Google Gemini | generativelanguage.googleapis.com | /v1beta/openai/chat/completions | /v1beta/openai/models | Bearer | gemini-3.8-flash | gemini-2.0-* shut down. Image generation stays in `gemini-image`. |
| Groq | api.groq.com | /openai/v1/chat/completions | /openai/v1/models | Bearer | live list | |
| Mistral | api.mistral.ai | /v1/chat/completions | /v1/models | Bearer | live list | |
| DeepSeek | api.deepseek.com | /chat/completions (root) | /models | Bearer | live list | UI default moved to root; saved `/v1` records keep working. **IP:** first-party API is not an approved route for unpublished canon. |
| Together AI | api.together.ai (+ legacy .xyz) | /v1/chat/completions | /v1/models | Bearer | live list | UI default moved to `.ai`; `.xyz` added to the UI host set so legacy records stay "built-in". |
| Fireworks | api.fireworks.ai | /inference/v1/chat/completions | /inference/v1/models | Bearer | live list | |
| Perplexity | api.perplexity.ai | /chat/completions | — (no list API) | Bearer | sonar | Owner types the id. |
| Cohere | api.cohere.ai | /compatibility/v1/chat/completions | /compatibility/v1/models | Bearer | live list | |
| Azure OpenAI | *.openai.azure.com | /openai/deployments/{d}/chat/completions | /openai/models | api-key | deployment name | api-version validated and carried. |
| Ollama / LM Studio | — | — | — | — | — | Still refused by the hosted proxy. Local testing lands in Lane B (browser-direct + local fleet gateway). |
| ElevenLabs | — | — | — | — | — | Voice, not text automation. |

## What changed

- `ai-provider-endpoint.ts`: every policy now declares `modelsPath`; new
  `resolveAiProviderModelsEndpoint()` derives the list URL from the already-validated
  chat endpoint, so it cannot reach a host or port the proxy could not.
- New edge function `ai-models` (AAL2): lists models for a saved backend (key read from
  Vault, never returned) or for a provider + key the owner is about to save. 4 MB
  response cap, 500-model cap, 12 s timeout, `redirect: "error"`.
- Owner form: model field is a combobox with **Load models from provider**.
- Stale hints removed (grok-2-latest, gpt-4o, claude-3-5-sonnet-latest, gemini-1.5-pro …).

## Open

- Ollama Cloud (`ollama.com/v1`) as a hosted policy — waiting on owner decision and a
  terms/retention check before any canon routes through it.
- Deploy: `supabase functions deploy ai-models` (JWT verification on, default).

# AliaSpaces local fleet gateway

Lets hosted persona automation use a model running on the owner's own GPU (sophia,
RTX 4090) without exposing LM Studio or Ollama to the network.

```
ai-proxy (Supabase edge)                       sophia
  │  HTTPS + CF-Access-Client-Id/Secret         ┌─────────────────────────────┐
  │  + Authorization: Bearer LOCAL_GATEWAY_TOKEN │ cloudflared (service)       │
  └──► fleet.<your-domain> ──Cloudflare Access──►   → http://127.0.0.1:8787    │
                                                │ gateway.mjs (this folder)   │
                                                │   → http://127.0.0.1:1234/v1│
                                                │ LM Studio / Ollama          │
                                                └─────────────────────────────┘
```

Three independent locks: Cloudflare Access service token (edge), gateway bearer token
(origin), and a model allowlist. The model server itself never leaves loopback.

## What the gateway enforces

It binds to `127.0.0.1` only and refuses a non-loopback upstream. It checks the bearer
token in constant time. It serves exactly one route, `POST /v1/chat/completions`, plus
`GET /healthz`. Requests with a model outside `GATEWAY_MODELS`, any tools or functions,
more than 40 messages, a message over 16 KB, a body over 64 KB, or a last message that
isn't the user's are rejected before the GPU is touched. Only `model`, `messages`,
`temperature`, `max_tokens` and `stream` are forwarded; `max_tokens` is capped. It runs
one generation at a time (a busy engine returns 429) with a 90 s timeout. The upstream
stream is re-emitted in the exact shape `supabase/functions/_shared/fleet-protocol.ts`
accepts (content deltas → one `stop`/`length` finish → `[DONE]`). Tool calls, empty
replies and malformed frames become stream errors. Output is capped at 64 KB.

Contract test: `tests/local-gateway.test.mjs` pipes gateway output through the edge
function's own `chatDeltas` parser.

## One-time setup on sophia (about 20 minutes)

### 1. Gateway

In an elevated PowerShell in this folder:

```powershell
.\install-sophia.ps1
```

It creates `%ProgramData%\AliaSpaces\local-gateway.env` with a fresh random token
(printed once), locks the file to you and SYSTEM, registers the logon task
**AliaSpaces Local Gateway**, and checks `http://127.0.0.1:8787/healthz`.

Edit the env file to set `GATEWAY_MODELS` (for example `gpt-oss:20b`) and
`GATEWAY_UPSTREAM` (LM Studio `http://127.0.0.1:1234/v1`, Ollama
`http://127.0.0.1:11434/v1`). Then restart the task.

### 2. Cloudflare Tunnel

Cloudflare dashboard → **Networking → Tunnels → Create a tunnel** (name it
`sophia-fleet`). Choose Windows, then run the install command it shows in an elevated
prompt; that installs `cloudflared` as a service. Then go to **Routes → Add route →
Published application**. Set the hostname to `fleet.<your-domain>` and the service to
`http://localhost:8787`.

### 3. Cloudflare Access (required — without it the hostname is public)

First create the service token. Go to **Zero Trust → Access controls → Service
credentials → Service Tokens → Create Service Token** and name it `supabase-ai-proxy`.
Copy the Client ID and Client Secret; the secret is shown once.

Then create the application. Go to **Zero Trust → Access controls → Applications →
Add an application → Self-hosted** and set the domain to `fleet.<your-domain>`. Add a
policy with action **Service Auth**, rule type Include, selector **Service Token**, value
`supabase-ai-proxy`. Add no other policies.

### 4. Supabase secrets

| Secret | Value |
|---|---|
| `LOCAL_FLEET_ENABLED` | `true` |
| `LOCAL_FLEET_BASE_URL` | `https://fleet.<your-domain>/v1` (no port, path exactly `/v1`) |
| `CF_ACCESS_CLIENT_ID` | from step 3 |
| `CF_ACCESS_CLIENT_SECRET` | from step 3 |
| `LOCAL_GATEWAY_TOKEN` | the token printed in step 1 |

### 5. Bind a persona

Create an `ai_backends` row with provider `local_fleet` for your account. Then add a
`local_fleet_personas` row for each persona that may use it, with `enabled = true`,
`hosted_content_approved = true`, and `model` set to one of `GATEWAY_MODELS`.
`local_fleet_begin` refuses anything else.

### Verify

From any machine:

```bash
# Expect 403 from Cloudflare (no service token):
curl -i https://fleet.<your-domain>/healthz
# Expect 401 from the gateway (service token but no bearer):
curl -i -H "CF-Access-Client-Id: …" -H "CF-Access-Client-Secret: …" \
  -X POST https://fleet.<your-domain>/v1/chat/completions
```

Then send a persona chat in the app for a persona bound in step 5.

## Turning it off

Set `LOCAL_FLEET_ENABLED=false` in Supabase; the edge returns 503 immediately. To cut
the path at the machine, stop the **AliaSpaces Local Gateway** task or the `cloudflared`
service. Rotate by re-running step 1 after deleting the env file, then update the secret.

## IP note

Only personas you explicitly approve (`hosted_content_approved`) route here. Prompts
leave Supabase only to your own machine. Unpublished canon is safe on this path.

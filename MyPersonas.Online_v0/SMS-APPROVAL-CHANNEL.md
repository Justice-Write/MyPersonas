# SMS approval channel

Status: **Code only; nothing deployed.** Migration 080, Edge Function `sms-approvals`, and
the agent-board card are in source. Deployment needs a Twilio number with US A2P 10DLC
registration, five function secrets, one cron entry, and the migration applied.

## What it does

An owner opts a phone number into the approval queue. When an agent board request or a
four-channel content package reaches `owner_review`, the owner gets a text with a short
decision code:

```
Agent task for Avi (review_draft, low risk)
Draft three X posts about the launch

Reply APPROVE 7Y23, REJECT 7Y23 <reason>, or EDIT 7Y23 <what to change>. Code expires in 72h.
```

Replies:

| Text | Effect |
| --- | --- |
| `APPROVE 7Y23` (also YES / OK / `7Y23 yes`) | Same outcome as the app's approve button: agent request → `approved` with the review hash recorded; content package → `approved` with `approval_hash`, `scheduled_for` cleared. |
| `REJECT 7Y23 too salesy` (NO / DENY) | Agent request → `rejected` with the reason; content package → `rejected`, reason appended to `owner_guidance`. |
| `EDIT 7Y23 shorter, drop hashtags` (CHANGE / REVISE / FIX) | Logs an `sms_edit_requests` row (shown on the agent board), appends the note to `owner_guidance` for kits, records an `escalated` decision for agent requests. The code stays open. |
| `APPROVE` with no code | Applies only when exactly one item is open; otherwise replies with the list. |
| `LIST` / `STATUS` | What is waiting, with codes. |
| `HELP` | The command card. |
| `STOP` / `START` | Pause / resume the channel (Twilio also enforces carrier STOP). |
| anything else | Sent to the owner's assigned assistant model. |

The assistant model is whichever linked model the owner picks under **Agent board → SMS
approvals → "Model that answers your texts"** (`owner_sms_channels.backend_id`). It gets
three tools: `get_pending_approvals`, `get_personas_and_automation` (read-only snapshot:
persona voice/purpose/audience/topics, agent board settings, bindings, research settings,
content plans, owner pause state and quiet hours, recent activity), and `decide_approval`
(bound to the same single-use codes). It cannot schedule, publish, change settings, or
read credentials, fan messages, or provider ids. Temperature 0.3, four tool rounds, ~450
output tokens, replies clamped to ~900 characters.

## Assurance model

The app's approval RPCs require `auth.uid()` plus an AAL2 JWT. SMS cannot carry that
claim, so the channel replaces it with a different, explicit chain:

1. **Enrollment is AAL2.** `sms_channel_begin_verification`, `…_confirm_verification`,
   `save_sms_channel_settings`, and `revoke_sms_channel` all `perform public.require_aal2()`
   and the Edge Function re-checks the bearer with `requireAal2` first. The 6-digit code
   is stored only as `sha256(owner:code)`, expires in 10 minutes, five attempts.
2. **Possession per decision.** Each texted code is unique per owner, 4 characters from
   an alphabet without 0/O/1/I and always containing a digit (so an English word can never
   parse as a code), single-use for approve/reject, expires in 72 hours, and is bound to
   one subject. Agent-board codes also carry the `agent_board_review_payload` hash; if the
   request changed since the text was sent, the old code is superseded and a fresh one is
   texted, mirroring the app's "review inputs changed" refusal.
3. **Sender authenticity.** Every inbound webhook is validated against
   `X-Twilio-Signature` (HMAC-SHA1 over the exact configured URL and sorted form fields)
   before any lookup. Unknown numbers, paused channels, duplicate `MessageSid`s, and
   over-limit senders get an empty TwiML response — no enumeration, no reply cost.
4. **Blast radius.** SMS can move an item to `approved` / `rejected` or file an edit
   request. It cannot create a schedule preview receipt, consume one, publish to a
   provider, or touch native page publication. Those remain AAL2 app flows.
5. **No Data API surface.** All four tables are service-role only. Owners see their own
   channel through `my_sms_channel()` and `my_sms_edit_requests()`.

Accepted residual risk: someone with the owner's unlocked phone can approve or reject
pre-execution items for up to 72 hours. Pause or remove the number from the app (AAL2)
to close it; `revoke_sms_channel` expires all open codes.

## Pieces

| Piece | Path |
| --- | --- |
| Migration | `sql-updates/080-sms-approval-channel.sql` = `supabase/migrations/20260930120000_sms_approval_channel.sql` |
| Edge Function | `supabase/functions/sms-approvals/index.ts` |
| Transport | `supabase/functions/_shared/sms-twilio.ts` (signature, send, TwiML) |
| Grammar | `supabase/functions/_shared/sms-commands.ts` (pure, unit-tested) |
| Assistant loop | `supabase/functions/_shared/sms-assistant.ts` (OpenAI-style + Anthropic tool calling via `ai-provider-endpoint.ts`) |
| UI | `sms-approvals-ui.js`, mounted in the agent board grid |
| Tests | `tests/sms-approval-channel.test.mjs` (`npm test`) |
| Erasure | `delete-account` calls `delete_sms_channel_data_for_account_service` |

Tables: `owner_sms_channels`, `sms_approval_tokens`, `sms_messages`, `sms_edit_requests`.
Triggers on `agent_board_requests` and `persona_content_packages` issue codes on entry
to `owner_review` and supersede them on exit.

## Deploy

1. Twilio: buy a US long code or create a Messaging Service; complete A2P 10DLC brand +
   campaign registration (required for US application traffic; carriers filter or block
   unregistered 10DLC). Sole-proprietor brand is the low-volume path. Set the number's
   inbound webhook to `https://<ref>.functions.supabase.co/sms-approvals?action=inbound`
   (POST).
2. Secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` **or**
   `TWILIO_MESSAGING_SERVICE_SID`, `SMS_WEBHOOK_URL` (must equal the URL configured in
   Twilio byte-for-byte, query string included), `CRON_SECRET` (existing).
3. Apply 080 in the SQL Editor.
4. `supabase functions deploy sms-approvals --no-verify-jwt`.
5. Cron: POST `…/sms-approvals?action=dispatch` with `X-Cron-Secret` every minute
   (sends queued notices, expires stale codes). Same pattern as `run-post-queue`.
6. `index.html`: bump `agent-board.js` cache key; `sms-approvals-ui.js` is loaded before it.

Cost (Twilio US pricing page, read 2026-09-30): $0.0083 per outbound and inbound segment
plus carrier pass-through (e.g. $0.0035 AT&T), plus 10DLC registration fees. One approval
round trip is roughly two to four segments. Per-owner ceilings: 200 inbound and 60
assistant replies per 24h (`owner_sms_channels`).

## Verification done in source

- Migration applied clean on a stub of the live schema (PostgreSQL 16) and exercised end
  to end: enrollment → wrong/right code → agent-board code → edit (stays open) → drift
  → re-issue → approve (hash recorded) → incomplete kit refused → complete kit approved →
  outbound claim/mark → duplicate inbound ignored → revoke → erasure.
- Twilio signature implementation reproduces the reference vector from Twilio's webhook
  security documentation and rejects URL, parameter, and token drift.
- `tsc --strict` clean on the function and shared modules (Deno/Supabase imports shimmed).
- `node --test` 8/8.

Not done: a live Twilio round trip, a live provider tool-calling run against each backend
kind, and `deno check` under the Supabase toolchain (CI).

## Changelog

- 2026-09-30 — Initial design and implementation (migration 080, `sms-approvals`,
  shared modules, UI card, tests, erasure hook). Nothing deployed.

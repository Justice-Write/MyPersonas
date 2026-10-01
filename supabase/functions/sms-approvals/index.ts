// sms-approvals — SMS channel for the owner approval queue.
//
// Actions (POST ?action=…):
//   inbound   Twilio message webhook (form-encoded, X-Twilio-Signature). Applies
//             APPROVE/REJECT/EDIT <code>, LIST, HELP, STOP/START inline (TwiML
//             reply). Anything else goes to the owner's assigned assistant
//             model in the background and is answered via the REST API.
//   status    Twilio status callback; records delivered/failed per MessageSid.
//   dispatch  Cron (X-Cron-Secret): sends queued outbound texts, expires codes.
//   enroll    Owner bearer + AAL2: { phone, consentVersion } → texts a 6-digit code.
//   verify    Owner bearer + AAL2: { code } → activates the channel.
//   settings  Owner bearer + AAL2: { backendId, notifyTypes, assistantEnabled, paused }.
//   revoke    Owner bearer + AAL2: removes the number and open codes.
//
// Deploy: supabase functions deploy sms-approvals --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (E.164) or
//   TWILIO_MESSAGING_SERVICE_SID, SMS_WEBHOOK_URL (the exact public URL Twilio
//   posts to, e.g. https://<ref>.functions.supabase.co/sms-approvals?action=inbound).
//
// SMS never schedules or publishes. See SMS-APPROVAL-CHANNEL.md.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAal2 } from "../_shared/aal2.ts";
import {
  clampSms, HELP_TEXT, normalizeCode, parseSmsCommand, type SmsDecision,
} from "../_shared/sms-commands.ts";
import {
  formToRecord, sendTwilioSms, twiml, type TwilioSendConfig, verifyTwilioSignature,
} from "../_shared/sms-twilio.ts";
import {
  type AssistantTool, type AssistantTurn, runSmsAssistant, type SmsBackend,
} from "../_shared/sms-assistant.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const TWILIO: TwilioSendConfig = {
  accountSid: Deno.env.get("TWILIO_ACCOUNT_SID") || "",
  authToken: Deno.env.get("TWILIO_AUTH_TOKEN") || "",
  from: Deno.env.get("TWILIO_FROM_NUMBER") || undefined,
  messagingServiceSid: Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || undefined,
};
const WEBHOOK_URL = Deno.env.get("SMS_WEBHOOK_URL") || "";
const STATUS_URL = WEBHOOK_URL ? WEBHOOK_URL.replace(/action=inbound/, "action=status") : "";
const CONSENT_VERSION_PATTERN = /^[a-z0-9.-]{1,40}$/i;
const E164 = /^\+[1-9][0-9]{7,14}$/;
const SAFE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORIGINS = new Set([
  "https://aliaspaces.com",
  "https://www.aliaspaces.com",
  "https://app.aliaspaces.com",
  "https://mypersonas.online",
]);

function json(body: unknown, status = 200, origin = "") {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      ...(origin && ORIGINS.has(origin)
        ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Vary": "Origin",
        }
        : {}),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sixDigitCode() {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(buffer[0] % 1_000_000).padStart(6, "0");
}

const waitUntil = (promise: Promise<unknown>) => {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(promise);
  else promise.catch((error) => console.error("background task failed", error));
};

type PendingRow = {
  code: string; subject_type: string; subject_id: string; persona_name: string | null;
  title: string | null; expires_at: string;
};

async function pendingList(owner: string): Promise<PendingRow[]> {
  const { data, error } = await admin.rpc("sms_pending_service", { p_owner: owner });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data as PendingRow[] : [];
}

function describePending(rows: PendingRow[]) {
  if (!rows.length) return "Nothing is waiting for your approval.";
  const lines = rows.slice(0, 8).map((row) =>
    `${row.code} ${row.subject_type === "content_package" ? "kit" : "task"} · ${row.persona_name || "persona"}: ${(row.title || "").slice(0, 60)}`
  );
  return `${rows.length} waiting:\n${lines.join("\n")}\n\nAPPROVE/REJECT/EDIT <code>.`;
}

async function decide(owner: string, code: string, decision: SmsDecision, note: string) {
  const { data, error } = await admin.rpc("sms_decide_service", {
    p_owner: owner, p_code: code, p_decision: decision, p_note: note,
  });
  if (error) return { ok: false, message: "That could not be applied right now. Try again or use the app." };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: !!row?.ok, message: String(row?.message || "Done.") };
}

async function record(
  owner: string, phone: string, direction: "inbound" | "outbound", kind: string,
  body: string, status: string, providerSid = "", tokenId: string | null = null,
) {
  const { data } = await admin.rpc("sms_record_message_service", {
    p_owner: owner, p_phone: phone, p_direction: direction, p_kind: kind, p_body: body,
    p_status: status, p_provider_sid: providerSid, p_token_id: tokenId,
  });
  return typeof data === "string" ? data : null;
}

// Send now (assistant replies, verification codes). Queue rows are for
// trigger-generated notices and are drained by dispatch.
async function sendNow(owner: string, phone: string, kind: string, body: string) {
  const text = clampSms(body, 1200);
  const sent = await sendTwilioSms(TWILIO, phone, text, STATUS_URL || undefined);
  await record(owner, phone, "outbound", kind, text, sent.ok ? "sent" : "failed", sent.ok ? sent.sid : "");
  if (!sent.ok) console.error("sms send failed", sent.error);
  return sent.ok;
}

function assistantTools(owner: string): AssistantTool[] {
  return [
    {
      name: "get_pending_approvals",
      description: "List items waiting for the owner's approval with their decision codes.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      run: async () => JSON.stringify(await pendingList(owner)),
    },
    {
      name: "get_personas_and_automation",
      description:
        "Read-only snapshot of the owner's personas (voice, purpose, audience, topics, limits), each persona's agent board / research / content plan configuration, account-wide automation settings (pause state, quiet hours, daily draft limit), pending approvals, and recent activity.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const { data, error } = await admin.rpc("sms_assistant_context_service", { p_owner: owner });
        if (error) throw new Error(error.message);
        return JSON.stringify(data ?? {});
      },
    },
    {
      name: "decide_approval",
      description:
        "Apply the owner's decision to one waiting item. Only call this when the owner clearly asked to approve, reject, or request edits on a specific item. For edit requests, note must say what to change.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "The 4-character decision code, e.g. A7K2" },
          decision: { type: "string", enum: ["approve", "reject", "edit"] },
          note: { type: "string", description: "Reason (reject) or requested change (edit). Optional for approve." },
        },
        required: ["code", "decision"],
        additionalProperties: false,
      },
      run: async (args) => {
        const code = normalizeCode(String(args.code || ""));
        const decision = String(args.decision || "") as SmsDecision;
        if (!code || !["approve", "reject", "edit"].includes(decision)) {
          return JSON.stringify({ ok: false, message: "Invalid code or decision" });
        }
        return JSON.stringify(await decide(owner, code, decision, String(args.note || "").slice(0, 1000)));
      },
    },
  ];
}

type ChannelRow = {
  owner: string; status: string; backend_id: string | null; assistant_enabled: boolean;
  inbound_today: number; assistant_today: number; daily_inbound_limit: number; daily_assistant_limit: number;
};

async function answerWithAssistant(channel: ChannelRow, phone: string, message: string) {
  if (!channel.assistant_enabled || !channel.backend_id) {
    await sendNow(channel.owner, phone, "system", `Your SMS assistant is not set up. Assign a model under Settings → SMS approvals in the app. ${HELP_TEXT}`);
    return;
  }
  if (channel.assistant_today >= channel.daily_assistant_limit) {
    await sendNow(channel.owner, phone, "system", "Daily SMS assistant limit reached. Commands (APPROVE/REJECT/EDIT/LIST) still work; questions resume tomorrow.");
    return;
  }
  const backend = await admin.from("ai_backends")
    .select("id,owner,name,provider,base_url,api_key,model,extra")
    .eq("id", channel.backend_id).eq("owner", channel.owner).maybeSingle();
  if (backend.error || !backend.data) {
    await sendNow(channel.owner, phone, "system", "The model assigned to SMS is no longer linked. Pick another in the app.");
    return;
  }
  const row = backend.data as SmsBackend & { api_key: string | null };
  let apiKey = String(row.api_key || "").trim();
  if (!apiKey) {
    const key = await admin.rpc("ai_backend_get_key", { p_backend_id: row.id, p_owner: channel.owner });
    apiKey = typeof key.data === "string" ? key.data.trim() : "";
  }
  const recent = await admin.rpc("sms_recent_conversation_service", { p_owner: channel.owner, p_limit: 12 });
  const history: AssistantTurn[] = (Array.isArray(recent.data) ? recent.data as Record<string, string>[] : [])
    .filter((turn) => turn.kind !== "verification")
    .reverse()
    .slice(0, -1) // the current inbound message was just recorded; it is passed separately
    .map((turn) => ({ role: turn.direction === "inbound" ? "owner" : "assistant", text: turn.body }));

  const result = await runSmsAssistant({
    backend: row, apiKey, history, message, tools: assistantTools(channel.owner),
    systemSuffix: `Model label chosen by the owner: ${row.name}.`,
  });
  if (!result.ok) {
    console.error("sms assistant failed", result.code, result.error);
    await sendNow(channel.owner, phone, "system", `Assistant unavailable (${result.code}). Commands still work: ${HELP_TEXT}`);
    return;
  }
  await sendNow(channel.owner, phone, "assistant", result.text);
}

// ---------------------------------------------------------------------------
// Twilio inbound
// ---------------------------------------------------------------------------
async function handleInbound(req: Request) {
  if (!WEBHOOK_URL || !TWILIO.authToken) return new Response("not configured", { status: 503 });
  const form = await req.formData().catch(() => null);
  if (!form) return new Response("bad request", { status: 400 });
  const params = formToRecord(form);
  const valid = await verifyTwilioSignature({
    authToken: TWILIO.authToken, url: WEBHOOK_URL, params, signature: req.headers.get("X-Twilio-Signature"),
  });
  if (!valid) return new Response("forbidden", { status: 403 });

  const from = String(params.From || "").trim();
  const body = String(params.Body || "").slice(0, 1600);
  const sid = String(params.MessageSid || params.SmsSid || "").slice(0, 64);
  if (!E164.test(from)) return twiml();

  const resolved = await admin.rpc("sms_resolve_inbound_service", { p_phone: from });
  const channel = (Array.isArray(resolved.data) ? resolved.data[0] : resolved.data) as ChannelRow | null;
  // Unknown numbers get silence: no enumeration, no reply cost.
  if (resolved.error || !channel) return twiml();

  const command = parseSmsCommand(body);
  if (channel.inbound_today >= channel.daily_inbound_limit) return twiml();
  const recordedId = await record(channel.owner, from, "inbound", command.kind === "chat" ? "assistant" : "command", body, "received", sid);
  if (sid && recordedId === null) return twiml(); // duplicate delivery of the same MessageSid

  if (command.kind === "stop") {
    await admin.from("owner_sms_channels").update({ status: "paused" }).eq("owner", channel.owner);
    return twiml(); // Twilio sends the carrier-mandated STOP confirmation itself.
  }
  if (channel.status === "paused") {
    if (command.kind === "start") {
      await admin.from("owner_sms_channels").update({ status: "active" }).eq("owner", channel.owner);
      return twiml("SMS approvals resumed. " + HELP_TEXT);
    }
    return twiml();
  }
  if (command.kind === "start") return twiml("SMS approvals are already on.");
  if (command.kind === "empty") return twiml(HELP_TEXT);
  if (command.kind === "help") return twiml(HELP_TEXT);
  if (command.kind === "list") return twiml(describePending(await pendingList(channel.owner)));
  if (command.kind === "decision") {
    let code = command.code;
    if (!code) {
      const open = await pendingList(channel.owner);
      if (open.length === 1) code = open[0].code;
      else if (!open.length) return twiml("Nothing is waiting for a decision.");
      else return twiml("Which one? " + describePending(open));
    }
    const applied = await decide(channel.owner, code, command.decision, command.note);
    await record(channel.owner, from, "outbound", "decision_receipt", applied.message, "sent");
    return twiml(applied.message);
  }
  // Free-form: acknowledge nothing inline (the answer follows by REST) so the
  // 15s webhook budget is never a factor.
  waitUntil(answerWithAssistant(channel, from, command.text));
  return twiml();
}

async function handleStatus(req: Request) {
  if (!WEBHOOK_URL || !TWILIO.authToken) return new Response("not configured", { status: 503 });
  const form = await req.formData().catch(() => null);
  if (!form) return new Response("bad request", { status: 400 });
  const params = formToRecord(form);
  const valid = await verifyTwilioSignature({
    authToken: TWILIO.authToken, url: STATUS_URL, params, signature: req.headers.get("X-Twilio-Signature"),
  });
  if (!valid) return new Response("forbidden", { status: 403 });
  const sid = String(params.MessageSid || "").slice(0, 64);
  const status = String(params.MessageStatus || "").toLowerCase();
  if (sid && ["delivered", "failed", "undelivered"].includes(status)) {
    await admin.from("sms_messages")
      .update({ status: status === "delivered" ? "delivered" : "failed", error: status === "delivered" ? "" : `carrier ${status} ${params.ErrorCode || ""}`.trim() })
      .eq("provider_sid", sid).eq("direction", "outbound");
  }
  return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// Cron dispatch
// ---------------------------------------------------------------------------
async function handleDispatch(req: Request) {
  if (!CRON_SECRET || req.headers.get("X-Cron-Secret") !== CRON_SECRET) return json({ error: "forbidden" }, 403);
  const expired = await admin.rpc("sms_expire_tokens_service");
  const claimed = await admin.rpc("sms_claim_outbound_service", { p_limit: 25 });
  if (claimed.error) return json({ error: claimed.error.message }, 500);
  const rows = Array.isArray(claimed.data) ? claimed.data as Record<string, unknown>[] : [];
  let sent = 0, failed = 0;
  for (const row of rows) {
    const result = await sendTwilioSms(TWILIO, String(row.phone_e164), String(row.body), STATUS_URL || undefined);
    await admin.rpc("sms_mark_outbound_service", {
      p_id: row.id,
      p_status: result.ok ? "sent" : "failed",
      p_provider_sid: result.ok ? result.sid : "",
      p_error: result.ok ? "" : result.error,
    });
    if (result.ok) sent++;
    else {
      failed++;
      // Non-retryable provider rejections should not burn the remaining attempts.
      if (!result.retryable) await admin.from("sms_messages").update({ attempts: 3 }).eq("id", row.id);
    }
  }
  return json({ claimed: rows.length, sent, failed, expired_codes: expired.data ?? 0 });
}

// ---------------------------------------------------------------------------
// Owner (AAL2) actions
// ---------------------------------------------------------------------------
async function handleOwner(req: Request, action: string, origin: string) {
  const guard = await requireAal2(req, admin);
  if (!guard.ok) return json({ error: guard.error, code: guard.code }, guard.status, origin);
  const user = guard.user;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "A JSON request body is required." }, 400, origin);
  // Owner-session RPCs are called with the owner's own JWT so auth.uid() and
  // the AAL2 claim are enforced a second time inside Postgres.
  const asOwner = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${guard.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "enroll") {
    const phone = String(body.phone || "").replace(/[\s()-]/g, "");
    const consentVersion = String(body.consentVersion || "");
    if (!E164.test(phone)) return json({ error: "Enter the number in E.164 form, e.g. +19075551234." }, 400, origin);
    if (!CONSENT_VERSION_PATTERN.test(consentVersion)) return json({ error: "Consent version is required." }, 400, origin);
    if (!TWILIO.authToken) return json({ error: "SMS is not configured on this deployment." }, 503, origin);
    const code = sixDigitCode();
    const begun = await asOwner.rpc("sms_channel_begin_verification", {
      p_phone: phone, p_code_hash: await sha256Hex(`${user.id}:${code}`), p_consent_version: consentVersion,
    });
    if (begun.error) return json({ error: begun.error.message }, 409, origin);
    const delivered = await sendNow(user.id, phone, "verification", `${code} is your AliaSpaces verification code. It expires in 10 minutes. Reply STOP to opt out.`);
    if (!delivered) return json({ error: "The verification text could not be sent. Check the number and try again." }, 502, origin);
    return json({ ok: true }, 200, origin);
  }
  if (action === "verify") {
    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length !== 6) return json({ error: "Enter the 6-digit code." }, 400, origin);
    const confirmed = await asOwner.rpc("sms_channel_confirm_verification", {
      p_code_hash: await sha256Hex(`${user.id}:${code}`),
    });
    if (confirmed.error) return json({ error: confirmed.error.message }, 409, origin);
    if (confirmed.data !== true) return json({ error: "That code did not match." }, 400, origin);
    const channel = await asOwner.rpc("my_sms_channel");
    const row = Array.isArray(channel.data) ? channel.data[0] : null;
    if (row?.phone_e164) {
      await sendNow(user.id, String(row.phone_e164), "system", `SMS approvals are on. ${HELP_TEXT}`);
    }
    return json({ ok: true, channel: row }, 200, origin);
  }
  if (action === "settings") {
    const backendId = body.backendId == null ? null : String(body.backendId);
    if (backendId !== null && !SAFE_UUID.test(backendId)) return json({ error: "Invalid model id." }, 400, origin);
    const notifyTypes = Array.isArray(body.notifyTypes) ? body.notifyTypes.map(String) : ["content_review", "agent_board_review"];
    const saved = await asOwner.rpc("save_sms_channel_settings", {
      p_backend_id: backendId,
      p_notify_types: notifyTypes,
      p_assistant_enabled: body.assistantEnabled !== false,
      p_paused: body.paused === true,
    });
    if (saved.error) return json({ error: saved.error.message }, 409, origin);
    const channel = await asOwner.rpc("my_sms_channel");
    return json({ ok: true, channel: Array.isArray(channel.data) ? channel.data[0] : null }, 200, origin);
  }
  if (action === "revoke") {
    const revoked = await asOwner.rpc("revoke_sms_channel");
    if (revoked.error) return json({ error: revoked.error.message }, 409, origin);
    return json({ ok: true }, 200, origin);
  }
  return json({ error: "Unknown action." }, 400, origin);
}

serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  if (req.method === "OPTIONS") return json(null, 204, origin);
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 32 * 1024) return json({ error: "Request body is too large." }, 413, origin);
  try {
    if (action === "inbound") return await handleInbound(req);
    if (action === "status") return await handleStatus(req);
    if (action === "dispatch") return await handleDispatch(req);
    if (["enroll", "verify", "settings", "revoke"].includes(action)) return await handleOwner(req, action, origin);
    return json({ error: "Unknown action." }, 400, origin);
  } catch (error) {
    console.error("sms-approvals failed", (error as Error).message);
    // Twilio retries on non-2xx; an empty TwiML keeps a transient failure quiet.
    if (action === "inbound") return twiml();
    return json({ error: "Internal error" }, 500, origin);
  }
});

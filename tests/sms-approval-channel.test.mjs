import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (value) => readFile(path.join(root, value), "utf8");
const [sql, fn, assistant] = await Promise.all([
  read("MyPersonas.Online_v0/sql-updates/080-sms-approval-channel.sql"),
  read("supabase/functions/sms-approvals/index.ts"),
  read("supabase/functions/_shared/sms-assistant.ts"),
]);
const { parseSmsCommand, normalizeCode, clampSms } = await import(
  "../supabase/functions/_shared/sms-commands.ts"
);
const { computeTwilioSignature, verifyTwilioSignature, twilioSignedPayload } = await import(
  "../supabase/functions/_shared/sms-twilio.ts"
);
const functionBody = (name) => sql.match(
  new RegExp(`create or replace function public\\.${name}\\b[\\s\\S]*?\\n\\$\\$;`, "i"),
)?.[0] || "";

test("command grammar: decisions, codes, notes, and chat fallthrough", () => {
  assert.deepEqual(parseSmsCommand("APPROVE A7K2"), { kind: "decision", decision: "approve", code: "A7K2", note: "" });
  assert.deepEqual(parseSmsCommand("yes a7k2"), { kind: "decision", decision: "approve", code: "A7K2", note: "" });
  assert.deepEqual(parseSmsCommand("Reject A7K2 too salesy"), { kind: "decision", decision: "reject", code: "A7K2", note: "too salesy" });
  assert.deepEqual(parseSmsCommand("EDIT A7K2 shorter, drop the hashtags"), { kind: "decision", decision: "edit", code: "A7K2", note: "shorter, drop the hashtags" });
  assert.deepEqual(parseSmsCommand("A7K2 no"), { kind: "decision", decision: "reject", code: "A7K2", note: "" });
  assert.deepEqual(parseSmsCommand("approve"), { kind: "decision", decision: "approve", code: null, note: "" });
  assert.equal(parseSmsCommand("yes that looks great, what else is Avi posting?").kind, "chat");
  assert.equal(parseSmsCommand("LIST").kind, "list");
  assert.equal(parseSmsCommand("status").kind, "list");
  assert.equal(parseSmsCommand("help").kind, "help");
  assert.equal(parseSmsCommand("STOP").kind, "stop");
  assert.equal(parseSmsCommand("start").kind, "start");
  assert.equal(parseSmsCommand("   ").kind, "empty");
  assert.equal(parseSmsCommand("what's Brom's posting cadence?").kind, "chat");
});

test("codes reject the ambiguous alphabet and wrong lengths", () => {
  assert.equal(normalizeCode("a7k2"), "A7K2");
  assert.equal(normalizeCode("A7K2."), "A7K2");
  assert.equal(normalizeCode("A0K2"), null);
  assert.equal(normalizeCode("AIK2"), null);
  assert.equal(normalizeCode("A7K"), null);
  assert.equal(normalizeCode("THAT"), null, "four-letter words are not codes");
  assert.deepEqual(parseSmsCommand("approve that"), { kind: "decision", decision: "approve", code: null, note: "that" });
  assert.match(sql, /code ~ '\^\[A-HJ-NP-Z2-9\]\{4\}\$' and code ~ '\[2-9\]'/);
  assert.match(functionBody("sms_new_decision_code"), /if v_code ~ '\[2-9\]' and not exists/);
});

test("Twilio signature matches the documented vector and rejects drift", async () => {
  // Reference vector from Twilio's webhook security documentation.
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = { CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212" };
  assert.equal(
    twilioSignedPayload(url, params),
    url + "CallSidCA1234567890ABCDECaller+12349013030Digits1234From+12349013030To+18005551212",
  );
  const signature = await computeTwilioSignature("12345", url, params);
  assert.equal(signature, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
  assert.equal(await verifyTwilioSignature({ authToken: "12345", url, params, signature }), true);
  assert.equal(await verifyTwilioSignature({ authToken: "12345", url, params: { ...params, Body: "x" }, signature }), false);
  assert.equal(await verifyTwilioSignature({ authToken: "12345", url: url + "&z=1", params, signature }), false);
  assert.equal(await verifyTwilioSignature({ authToken: "12345", url, params, signature: null }), false);
  assert.equal(await verifyTwilioSignature({ authToken: "", url, params, signature }), false);
});

test("SMS never schedules or publishes; decisions are token-bound and hash-checked", () => {
  const decide = functionBody("sms_decide_service");
  assert.ok(decide, "sms_decide_service present");
  assert.doesNotMatch(decide, /schedule_content_package|post_draft_schedule|issue_post_draft|consume_acknowledged|publish/i);
  assert.match(decide, /where owner = p_owner and code = upper\(p_code\) and status = 'open' for update/);
  assert.match(decide, /if v_hash <> v_token\.review_hash then[\s\S]*superseded[\s\S]*sms_notify_agent_board_review_reissue/);
  assert.match(decide, /is distinct from array\['facebook','instagram','website','x'\]/);
  assert.match(decide, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(p_owner::text, 51051120\)\)/);
  assert.match(decide, /scheduled_for = null/);
});

test("enrollment and settings are AAL2 owner RPCs; service RPCs are service_role only", () => {
  for (const name of ["sms_channel_begin_verification", "sms_channel_confirm_verification", "save_sms_channel_settings", "revoke_sms_channel"]) {
    assert.match(functionBody(name), /perform public\.require_aal2\(\)/, `${name} requires AAL2`);
  }
  assert.match(sql, /revoke all on public\.owner_sms_channels, public\.sms_approval_tokens,\s*public\.sms_messages, public\.sms_edit_requests\s*from public, anon, authenticated/);
  for (const name of ["sms_decide_service", "sms_resolve_inbound_service", "sms_assistant_context_service", "sms_claim_outbound_service"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`));
  }
  assert.match(functionBody("sms_channel_confirm_verification"), /verification_attempts >= 5/);
  assert.match(sql, /verification_expires_at,\s*verification_attempts, consent_version, consented_at/);
});

test("assistant context exposes no credentials, and the assistant tool surface is bounded", () => {
  const context = functionBody("sms_assistant_context_service");
  assert.ok(context);
  assert.doesNotMatch(context, /api_key|vault|access_token|refresh_token|fan_messages|fan_inbox|mailbox|email|provider_sid/i);
  assert.match(fn, /name: "get_pending_approvals"/);
  assert.match(fn, /name: "get_personas_and_automation"/);
  assert.match(fn, /name: "decide_approval"/);
  assert.equal((fn.match(/^\s+name: "[a-z_]+",\n\s+description:/gm) || []).length, 3, "exactly three assistant tools");
  assert.match(assistant, /const MAX_ROUNDS = 4/);
  assert.match(assistant, /TEMPERATURE = 0\.3/);
  assert.match(assistant, /\["localfleet", "ollama", "lmstudio", "elevenlabs"\]\.includes\(provider\)/);
});

test("webhook path validates the signature before any lookup and stays silent for unknown numbers", () => {
  const inbound = fn.slice(fn.indexOf("async function handleInbound"), fn.indexOf("async function handleStatus"));
  assert.ok(inbound.indexOf("verifyTwilioSignature") < inbound.indexOf("sms_resolve_inbound_service"));
  assert.match(inbound, /if \(resolved\.error \|\| !channel\) return twiml\(\);/);
  assert.match(inbound, /waitUntil\(answerWithAssistant/);
  assert.match(fn, /X-Cron-Secret/);
  assert.match(fn, /requireAal2\(req, admin\)/);
});

test("clampSms keeps replies inside a sane segment budget", () => {
  const long = "Sentence one. ".repeat(200);
  const clamped = clampSms(long, 300);
  assert.ok(clamped.length <= 300);
  assert.ok(clamped.endsWith("…"));
  assert.equal(clampSms("short"), "short");
});

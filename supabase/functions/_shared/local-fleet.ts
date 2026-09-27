import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
import { chatDeltas, FleetError, fleetURL, frame } from "./fleet-protocol.ts";

const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
type Options = {
  req: Request; db: SupabaseClient; owner: string; persona: string; backend: string;
  payload: Record<string, unknown>; system: string; headers: Record<string, string>;
  safeHost: (hostname: string) => Promise<boolean>;
  audit: (status: "started" | "completed" | "failed", detail: Record<string, unknown>) => Promise<boolean>;
};

export async function localFleetChat(o: Options): Promise<Response> {
  const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { ...o.headers, "Content-Type": "application/json", ...(status === 429 ? { "Retry-After": "2" } : {}) } });
  const id = o.payload.requestId;
  if (!uuid(id) || (o.payload.workspaceId != null && !uuid(o.payload.workspaceId))) return json(400, { error: "A valid request and workspace id are required" });
  const messages = o.payload.messages;
  const latest = Array.isArray(messages) ? messages[messages.length - 1] : null;
  if (latest?.role !== "user" || typeof latest.content !== "string" || !latest.content.trim() || new TextEncoder().encode(latest.content).length > 4096) return json(400, { error: "Send a user message of at most 4096 UTF-8 bytes" });
  if (o.payload.attachedSummaries && (!Array.isArray(o.payload.attachedSummaries) || o.payload.attachedSummaries.length)) return json(400, { error: "Attached summaries are not enabled for local fleet chat" });
  let begun = false;
  let budgetLease: string | null = null, fetchIssued = false;
  let budgetFinalization: Promise<boolean> | null = null;
  const finalizeBudget = (completed: boolean) => {
    if (!budgetLease) return Promise.resolve(true);
    if (!budgetFinalization) budgetFinalization = (async () => {
      const result = await o.db.rpc("finalize_ai_backend_budget", {
        p_lease_id: budgetLease,
        p_outcome: completed ? "completed" : fetchIssued ? "request_failed" : "cancelled",
        p_actual_tokens: fetchIssued ? null : 0,
        p_provider_usage_reported: !fetchIssued,
        p_outcome_code: completed ? "local_fleet_completed" : "local_fleet_interrupted",
      });
      return !result.error && result.data === true;
    })();
    return budgetFinalization;
  };
  const controller = new AbortController();
  const disconnect = () => controller.abort();
  o.req.signal.addEventListener("abort", disconnect, { once: true });
  if (o.req.signal.aborted) disconnect();
  const timeout = setTimeout(disconnect, 90000);
  const cleanup = () => { clearTimeout(timeout); controller.abort(); o.req.signal.removeEventListener("abort", disconnect); };
  const failure = async (code: string) => {
    await finalizeBudget(false);
    if (begun) await o.db.from("local_fleet_turns").update({ status: "interrupted", finished_at: new Date().toISOString() }).eq("id", id).eq("owner", o.owner).eq("status", "running");
    await o.audit("failed", { request_id: id, code });
  };
  try {
    if (Deno.env.get("LOCAL_FLEET_ENABLED") !== "true") throw new FleetError("fleet_disabled", 503);
    const base = fleetURL(Deno.env.get("LOCAL_FLEET_BASE_URL") || "");
    if (!await o.safeHost(base.hostname)) throw new FleetError("fleet_configuration", 503);
    const client = Deno.env.get("CF_ACCESS_CLIENT_ID"), secret = Deno.env.get("CF_ACCESS_CLIENT_SECRET"), token = Deno.env.get("LOCAL_GATEWAY_TOKEN");
    if (!client || !secret || !token || token.length < 32) throw new FleetError("fleet_configuration", 503);
    const start = await o.db.rpc("local_fleet_begin", { p_id: id, p_owner: o.owner, p_persona: o.persona, p_backend: o.backend, p_workspace: o.payload.workspaceId || null, p_text: latest.content });
    if (start.error) {
      if (start.error.message.includes("owner_busy")) throw new FleetError("owner_busy", 429);
      throw new FleetError("fleet_not_ready_or_request_conflict", 409);
    }
    const turn = start.data?.turn;
    if (!turn || turn.owner !== o.owner || turn.persona_id !== o.persona) throw new FleetError("fleet_state_unavailable", 503);
    if (start.data.replayed) {
      cleanup();
      if (["completed", "truncated"].includes(turn.status)) return json(200, { content: turn.assistant_text, requestId: id, persisted: true, status: turn.status });
      return json(409, { error: "This request is already running or was interrupted. It will not be generated twice.", requestId: id });
    }
    begun = true;
    if (!await o.audit("started", { request_id: id, model: turn.model, product_scope: turn.product_scope })) throw new FleetError("audit_unavailable", 503);
    let historyQuery = o.db.from("local_fleet_turns").select("user_text,assistant_text").eq("owner", o.owner).eq("persona_id", o.persona).eq("product_scope", turn.product_scope).eq("conversation_key", turn.conversation_key);
    historyQuery = o.payload.workspaceId ? historyQuery.eq("workspace_id", o.payload.workspaceId) : historyQuery.is("workspace_id", null);
    const history = await historyQuery.in("status", ["completed", "truncated"]).order("created_at", { ascending: false }).limit(16);
    if (history.error) throw new FleetError("history_unavailable", 503);
    // Conservative byte cap below the gateway's measured context limit. Never trim policy or the new message.
    const bytes = (s: string) => new TextEncoder().encode(s).length;
    let remaining = 4000 - bytes(o.system) - bytes(latest.content);
    if (remaining < 0) throw new FleetError("context_too_large", 413);
    const prior: { role: string; content: string }[] = [];
    for (const row of history.data || []) {
      const cost = bytes(row.user_text) + bytes(row.assistant_text || "") + 2;
      if (cost > remaining) break;
      remaining -= cost;
      prior.unshift({ role: "user", content: row.user_text }, { role: "assistant", content: row.assistant_text });
    }
    const providerBody = JSON.stringify({ model: turn.model, messages: [{ role: "system", content: o.system }, ...prior, { role: "user", content: latest.content }], temperature: 0.9, max_tokens: 1024, stream: true });
    const claim = await o.db.rpc("claim_ai_backend_budget", {
      p_owner: o.owner, p_backend_id: o.backend, p_mode: "owner_chat",
      p_reserved_tokens: bytes(providerBody) + 1024, p_request_key: id,
    });
    const allowance = Array.isArray(claim.data) ? claim.data[0] : claim.data;
    if (claim.error || !allowance || typeof allowance.allowed !== "boolean") throw new FleetError("budget_unavailable", 503);
    if (!allowance.allowed) throw new FleetError("owner_budget_denied", 429);
    if (allowance.lease_id != null && !uuid(allowance.lease_id)) throw new FleetError("budget_unavailable", 503);
    budgetLease = allowance.lease_id || null;
    if (controller.signal.aborted) throw new FleetError("request_interrupted", 504);
    fetchIssued = true;
    const upstream = await fetch(new URL("chat/completions", base.href.replace(/\/?$/, "/")), {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { "Content-Type": "application/json", "CF-Access-Client-Id": client, "CF-Access-Client-Secret": secret, Authorization: `Bearer ${token}` },
      body: providerBody,
    });
    if (!upstream.ok || !upstream.body) { await upstream.body?.cancel(); throw new FleetError("local_engine_unavailable", upstream.status === 429 ? 429 : upstream.status === 504 ? 504 : 503); }
    if (!upstream.headers.get("content-type")?.includes("text/event-stream")) { await upstream.body.cancel(); throw new FleetError("invalid_gateway_stream"); }
    const iterator = chatDeltas(upstream.body)[Symbol.asyncIterator]();
    let content = "", status = "completed";
    const finish = async () => {
      if (controller.signal.aborted) throw new FleetError("request_interrupted", 504);
      if (!await finalizeBudget(true)) throw new FleetError("budget_finalize_failed", 503);
      if (!await o.audit("completed", { request_id: id, output_chars: content.length, status })) throw new FleetError("audit_unavailable", 503);
      const saved = await o.db.rpc("local_fleet_finish", { p_id: id, p_owner: o.owner, p_content: content, p_status: status }).abortSignal(controller.signal);
      if (saved.error || saved.data !== true) throw new FleetError("reply_not_saved", 503);
    };
    if (o.payload.stream !== true) {
      try {
        for await (const part of { [Symbol.asyncIterator]: () => iterator }) {
          if (part.done) status = part.reason === "length" ? "truncated" : "completed";
          else content += part.text;
        }
        await finish();
        cleanup();
        return json(200, { content, persisted: true, requestId: id, status });
      } finally { await iterator.return?.(); }
    }
    return new Response(new ReadableStream<Uint8Array>({
      async pull(stream) {
        try {
          const next = await iterator.next();
          if (next.done) throw new FleetError("stream_incomplete");
          if (!next.value.done) {
            content += next.value.text;
            stream.enqueue(frame("delta", { requestId: id, text: next.value.text }));
          } else {
            status = next.value.reason === "length" ? "truncated" : "completed";
            await finish();
            stream.enqueue(frame("done", { requestId: id, status, persisted: true }));
            stream.close(); cleanup(); await iterator.return?.();
          }
        } catch (error) {
          const code = controller.signal.aborted ? "request_interrupted" : error instanceof FleetError ? error.code : "fleet_error";
          await failure(code); cleanup();
          try { stream.enqueue(frame("error", { requestId: id, code })); stream.close(); } catch { /* Already cancelled. */ }
          await iterator.return?.();
        }
      },
      async cancel() { cleanup(); await failure("client_disconnected"); await iterator.return?.(); },
    }), { headers: { ...o.headers, "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform" } });
  } catch (error) {
    const code = controller.signal.aborted ? "request_interrupted" : error instanceof FleetError ? error.code : "fleet_error";
    await failure(code); cleanup();
    return json(error instanceof FleetError ? error.status : 503, { error: code, requestId: id });
  }
}


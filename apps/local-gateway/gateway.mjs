#!/usr/bin/env node
// AliaSpaces local fleet gateway.
//
// Sits between a Cloudflare Tunnel (guarded by a Cloudflare Access service token)
// and a loopback model server (LM Studio or Ollama). The hosted `ai-proxy` edge
// function reaches it as LOCAL_FLEET_BASE_URL and expects exactly the stream that
// supabase/functions/_shared/fleet-protocol.ts accepts:
//   content deltas → one finish_reason ("stop" | "length") → data: [DONE]
// The gateway re-emits a normalised stream so upstream quirks never reach the edge.
//
// Zero dependencies. Node 18+. Binds 127.0.0.1 only.
import http from "node:http";
import { timingSafeEqual, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const env = (k, d = "") => (process.env[k] ?? d).trim();
export function loadConfig(source = process.env) {
  const get = (k, d = "") => String(source[k] ?? d).trim();
  const token = get("LOCAL_GATEWAY_TOKEN");
  if (token.length < 32) throw new Error("LOCAL_GATEWAY_TOKEN must be at least 32 characters");
  const upstream = new URL(get("GATEWAY_UPSTREAM", "http://127.0.0.1:1234/v1"));
  if (!["127.0.0.1", "localhost", "[::1]"].includes(upstream.hostname)) {
    throw new Error("GATEWAY_UPSTREAM must be a loopback URL");
  }
  if (upstream.username || upstream.password || upstream.search || upstream.hash) {
    throw new Error("GATEWAY_UPSTREAM must not carry credentials, query or fragment");
  }
  const models = get("GATEWAY_MODELS").split(",").map((m) => m.trim()).filter(Boolean);
  if (!models.length) throw new Error("GATEWAY_MODELS must list at least one allowed model id");
  const port = Number(get("GATEWAY_PORT", "8787"));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("GATEWAY_PORT invalid");
  return {
    tokenHash: createHash("sha256").update(token).digest(),
    upstream: upstream.toString().replace(/\/+$/, ""),
    models: new Set(models),
    port,
    maxTokens: Math.min(Number(get("GATEWAY_MAX_TOKENS", "1024")) || 1024, 4096),
    timeoutMs: Math.min(Number(get("GATEWAY_TIMEOUT_MS", "90000")) || 90000, 120000),
  };
}

const MAX_BODY = 64 * 1024;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_OUTPUT_BYTES = 65536; // matches fleet-protocol response_too_large
const ROLES = new Set(["system", "user", "assistant"]);

function send(res, status, code) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ error: code }));
}

function authorized(req, cfg) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return false;
  const given = createHash("sha256").update(m[1]).digest();
  return timingSafeEqual(given, cfg.tokenHash);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error("too_large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Validate and rebuild the request; never forward caller-supplied extras (tools etc). */
export function sanitizeRequest(raw, cfg) {
  let body;
  try { body = JSON.parse(raw); } catch { return { error: "invalid_json" }; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "invalid_request" };
  if (typeof body.model !== "string" || !cfg.models.has(body.model)) return { error: "model_not_allowed" };
  if (body.tools || body.functions || body.tool_choice) return { error: "tools_not_supported" };
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > MAX_MESSAGES) return { error: "invalid_messages" };
  const messages = [];
  for (const m of body.messages) {
    if (!m || !ROLES.has(m.role) || typeof m.content !== "string") return { error: "invalid_messages" };
    if (Buffer.byteLength(m.content) > MAX_MESSAGE_BYTES) return { error: "message_too_large" };
    messages.push({ role: m.role, content: m.content });
  }
  if (messages.at(-1).role !== "user") return { error: "invalid_messages" };
  const temperature = Number.isFinite(body.temperature) ? Math.min(Math.max(body.temperature, 0), 2) : 0.7;
  const maxTokens = Number.isInteger(body.max_tokens) ? Math.min(Math.max(body.max_tokens, 1), cfg.maxTokens) : cfg.maxTokens;
  return { value: { model: body.model, messages, temperature, max_tokens: maxTokens, stream: true } };
}

const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`;

/** Parse upstream OpenAI-style SSE and yield {text} | {finish} | {error}. */
export async function* upstreamEvents(stream) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    if (buffer.length > 131072) { yield { error: "stream_record_too_large" }; return; }
    let idx;
    while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const record = buffer.slice(0, idx);
      buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
      const data = record.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
      if (!data) continue;
      if (data === "[DONE]") return;
      let evt;
      try { evt = JSON.parse(data); } catch { yield { error: "upstream_invalid_json" }; return; }
      if (evt.error) { yield { error: "upstream_stream_error" }; return; }
      const choice = evt.choices?.[0];
      if (!choice) continue;
      if (choice.delta?.tool_calls || choice.delta?.function_call) { yield { error: "tools_not_supported" }; return; }
      if (typeof choice.delta?.content === "string" && choice.delta.content) yield { text: choice.delta.content };
      if (choice.finish_reason != null) yield { finish: choice.finish_reason };
    }
  }
}

let busy = false; // One generation at a time: one GPU.

export function createGateway(cfg, fetchImpl = fetch) {
  return http.createServer(async (req, res) => {
    const path = (req.url || "").split("?")[0];
    if (req.method === "GET" && path === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return;
    }
    if (!authorized(req, cfg)) return send(res, 401, "unauthorized");
    if (req.method !== "POST" || path !== "/v1/chat/completions") return send(res, 404, "not_found");

    let raw;
    try { raw = await readBody(req); } catch { return send(res, 413, "request_too_large"); }
    const parsed = sanitizeRequest(raw, cfg);
    if (parsed.error) return send(res, 400, parsed.error);
    if (busy) return send(res, 429, "engine_busy");
    busy = true;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    res.on("close", () => controller.abort());
    try {
      const upstream = await fetchImpl(cfg.upstream + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(parsed.value),
        signal: controller.signal,
        redirect: "error",
      });
      if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel().catch(() => {});
        return send(res, upstream.status === 429 ? 429 : 503, "local_engine_unavailable");
      }
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" });
      const id = "local-" + Date.now();
      let bytes = 0, finish = null, failed = null;
      for await (const evt of upstreamEvents(upstream.body)) {
        if (evt.error) { failed = evt.error; break; }
        if (evt.text) {
          if (finish) { failed = "stream_after_finish"; break; }
          bytes += Buffer.byteLength(evt.text);
          if (bytes > MAX_OUTPUT_BYTES) { finish = "length"; break; }
          res.write(sse({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: evt.text }, finish_reason: null }] }));
        }
        if (evt.finish) finish = evt.finish === "stop" ? "stop" : "length";
      }
      if (failed || !bytes) {
        res.write(sse({ error: { code: failed || "empty_response" } }));
        res.end();
        return;
      }
      res.write(sse({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: finish || "stop" }] }));
      res.end("data: [DONE]\n\n");
    } catch {
      if (!res.headersSent) send(res, controller.signal.aborted ? 504 : 503, controller.signal.aborted ? "engine_timeout" : "local_engine_unavailable");
      else { res.write(sse({ error: { code: "upstream_interrupted" } })); res.end(); }
    } finally {
      clearTimeout(timer);
      busy = false;
    }
  });
}

const isMain = !!process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain && env("GATEWAY_NO_LISTEN") !== "1") {
  const cfg = loadConfig();
  createGateway(cfg).listen(cfg.port, "127.0.0.1", () => {
    console.log(`local fleet gateway on 127.0.0.1:${cfg.port} → ${cfg.upstream} (models: ${[...cfg.models].join(", ")})`);
  });
}

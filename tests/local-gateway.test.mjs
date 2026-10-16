// The gateway must emit exactly what the hosted edge function's parser accepts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chatDeltas } from "../supabase/functions/_shared/fleet-protocol.ts";
import { createGateway, loadConfig, sanitizeRequest } from "../apps/local-gateway/gateway.mjs";

const TOKEN = "t".repeat(40);
const cfg = loadConfig({ LOCAL_GATEWAY_TOKEN: TOKEN, GATEWAY_MODELS: "gpt-oss:20b", GATEWAY_UPSTREAM: "http://127.0.0.1:1234/v1" });
const enc = new TextEncoder();
const upstreamFrom = (frames, status = 200) => async () =>
  new Response(new ReadableStream({ start(c) { for (const f of frames) c.enqueue(enc.encode(f)); c.close(); } }), { status, headers: { "content-type": "text/event-stream" } });
const d = (o) => `data: ${JSON.stringify(o)}\n\n`;

async function withGateway(fetchImpl, fn) {
  const server = createGateway(cfg, fetchImpl);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base); } finally { server.close(); }
}
const call = (base, body, token = TOKEN) => fetch(base + "/v1/chat/completions", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body),
});
const good = { model: "gpt-oss:20b", messages: [{ role: "system", content: "s" }, { role: "user", content: "hi" }], stream: true, max_tokens: 1024, temperature: 0.9 };

async function consume(response) {
  const out = [];
  for await (const part of chatDeltas(response.body)) out.push(part);
  return out;
}

test("normalised stream passes the edge parser (Ollama/LM Studio quirks included)", async () => {
  // Ollama-style: role-only first delta, usage frame, finish in its own frame.
  const frames = [d({ choices: [{ delta: { role: "assistant" } }] }), d({ choices: [{ delta: { content: "Hel" } }] }), "data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\r\n\r\n", d({ choices: [{ delta: {}, finish_reason: "stop" }] }), d({ choices: [], usage: { completion_tokens: 2 } }), "data: [DONE]\n\n"];
  await withGateway(upstreamFrom(frames), async (base) => {
    const r = await call(base, good);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /text\/event-stream/);
    const parts = await consume(r);
    assert.equal(parts.filter((p) => !p.done).map((p) => p.text).join(""), "Hello");
    assert.deepEqual(parts.at(-1), { done: true, text: "", reason: "stop" });
  });
});

test("missing finish and missing [DONE] are repaired into a valid stop", async () => {
  await withGateway(upstreamFrom([d({ choices: [{ delta: { content: "x" } }] })]), async (base) => {
    const parts = await consume(await call(base, good));
    assert.equal(parts.at(-1).reason, "stop");
  });
});

test("upstream tool calls and empty replies surface as errors the edge rejects", async () => {
  await withGateway(upstreamFrom([d({ choices: [{ delta: { tool_calls: [{}] } }] })]), async (base) => {
    const r = await call(base, good);
    await assert.rejects(() => consume(r), /upstream_stream_error/);
  });
  await withGateway(upstreamFrom([d({ choices: [{ delta: { content: "" }, finish_reason: "stop" }] }), "data: [DONE]\n\n"]), async (base) => {
    const r = await call(base, good);
    await assert.rejects(() => consume(r), /upstream_stream_error/);
  });
});

test("auth, model allowlist and request shape are enforced before the GPU is touched", async () => {
  let touched = 0;
  const spy = async (...a) => { touched++; return upstreamFrom([d({ choices: [{ delta: { content: "x" }, finish_reason: "stop" }] })])(...a); };
  await withGateway(spy, async (base) => {
    assert.equal((await call(base, good, "wrong".repeat(10))).status, 401);
    assert.equal((await call(base, { ...good, model: "llama-evil" })).status, 400);
    assert.equal((await call(base, { ...good, tools: [{}] })).status, 400);
    assert.equal((await call(base, { ...good, messages: [{ role: "user", content: "x" }, { role: "assistant", content: "y" }] })).status, 400);
    assert.equal((await fetch(base + "/v1/models", { headers: { Authorization: "Bearer " + TOKEN } })).status, 404);
    assert.equal((await fetch(base + "/healthz")).status, 200);
    assert.equal(touched, 0);
  });
});

test("sanitizer strips extras and caps max_tokens", () => {
  const r = sanitizeRequest(JSON.stringify({ ...good, max_tokens: 999999, logit_bias: { 1: 100 }, temperature: 9 }), cfg);
  assert.deepEqual(Object.keys(r.value).sort(), ["max_tokens", "messages", "model", "stream", "temperature"]);
  assert.equal(r.value.max_tokens, 1024);
  assert.equal(r.value.temperature, 2);
});

test("config refuses weak tokens and non-loopback upstreams", () => {
  assert.throws(() => loadConfig({ LOCAL_GATEWAY_TOKEN: "short", GATEWAY_MODELS: "m" }));
  assert.throws(() => loadConfig({ LOCAL_GATEWAY_TOKEN: TOKEN, GATEWAY_MODELS: "m", GATEWAY_UPSTREAM: "http://192.168.1.4:1234/v1" }));
  assert.throws(() => loadConfig({ LOCAL_GATEWAY_TOKEN: TOKEN, GATEWAY_MODELS: "" }));
});

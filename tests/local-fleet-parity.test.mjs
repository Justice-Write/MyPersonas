import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chatDeltas, fleetURL } from "../supabase/functions/_shared/fleet-protocol.ts";

test("local fleet stream remains bounded, explicit, and tool-free", async () => {
  const consume = async (text) => {
    const result = [];
    for await (const part of chatDeltas(new Response(text).body)) result.push(part);
    return result;
  };
  const delta = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
  await assert.rejects(
    () => consume(delta + "data: [DONE]\n\n"),
    /stream_incomplete/,
  );
  await assert.rejects(
    () => consume('data: {"choices":[{"delta":{"tool_calls":[]}}]}\n\n'),
    /tools_not_supported/,
  );
  const result = await consume(
    delta +
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
      "data: [DONE]\n\n",
  );
  assert.equal(result.at(-1).done, true);
  for (const url of [
    "http://example.test/v1",
    "https://key@example.test/v1",
    "https://example.test/v1?token=x",
    "https://example.test:444/v1",
  ]) assert.throws(() => fleetURL(url));
});

test("main release preserves the deployed local-fleet guard around image drafting", async () => {
  const proxy = await readFile(
    new URL("../supabase/functions/ai-proxy/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(proxy, /import \{ localFleetChat \}/);
  assert.match(proxy, /local_fleet_image_input_unavailable/);
  assert.match(proxy, /This persona requires its configured local fleet connection/);
  assert.match(proxy, /mode === "general_chat" \? "owner_chat" : mode/);
  assert.match(proxy, /General chat cannot attach a persona/);
});

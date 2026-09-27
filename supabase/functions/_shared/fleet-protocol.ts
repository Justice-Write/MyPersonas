// Portable between the Edge Function, Node gateway and behavioral tests.
export class FleetError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 502) { super(code); this.code = code; this.status = status; }
}

export async function* sseRecords(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 131072) throw new FleetError("stream_record_too_large");
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const record = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        let event = "message";
        const data: string[] = [];
        for (const line of record.split(/\r?\n/)) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
        }
        if (data.length) yield { event, data: data.join("\n") };
      }
      if (done) {
        if (buffer.trim()) throw new FleetError("stream_incomplete");
        return;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function* chatDeltas(body: ReadableStream<Uint8Array>) {
  let finished = false;
  let size = 0;
  let reason = "";
  for await (const record of sseRecords(body)) {
    if (record.data === "[DONE]") {
      if (!finished || !size) throw new FleetError("stream_incomplete");
      yield { done: true, text: "", reason };
      return;
    }
    let chunk;
    try { chunk = JSON.parse(record.data); } catch { throw new FleetError("stream_invalid_json"); }
    if (chunk.error || record.event === "error") throw new FleetError("upstream_stream_error");
    const choice = chunk.choices?.[0];
    if (!choice) continue; // Usage-only frame.
    if (choice.delta?.tool_calls || choice.delta?.function_call) throw new FleetError("tools_not_supported");
    const text = choice.delta?.content;
    if (text != null && typeof text !== "string") throw new FleetError("stream_invalid_text");
    if (text) {
      if (finished) throw new FleetError("stream_after_finish");
      size += new TextEncoder().encode(text).length;
      if (size > 65536) throw new FleetError("response_too_large");
      yield { done: false, text, reason: "" };
    }
    if (choice.finish_reason != null) {
      if (finished || !["stop", "length"].includes(choice.finish_reason)) throw new FleetError("stream_invalid_finish");
      finished = true;
      reason = choice.finish_reason;
    }
  }
  throw new FleetError("stream_incomplete");
}

export function fleetURL(base: string) {
  let url: URL;
  try { url = new URL(base); } catch { throw new FleetError("fleet_configuration", 503); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.port || url.pathname.replace(/\/$/, "") !== "/v1") throw new FleetError("fleet_configuration", 503);
  return url;
}

export const frame = (event: string, value: unknown) =>
  new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);


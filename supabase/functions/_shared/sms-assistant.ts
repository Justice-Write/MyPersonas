// Tool-calling assistant loop for the SMS approval channel.
//
// The owner's assigned backend (owner_sms_channels.backend_id) answers
// questions about their personas and automation configuration and can apply
// approval decisions on their behalf. Every capability is a tool backed by a
// service RPC; the model never receives credentials, provider ids, or fan
// data, and the only mutating tool is decide_approval, which is bound to the
// same single-use decision codes as a typed APPROVE/REJECT/EDIT.
//
// Supports the two wire shapes the platform already routes: OpenAI-style
// chat completions (openai, azure, openrouter, groq, …) and Anthropic
// Messages. Local fleet / Ollama / LM Studio backends are not reachable from
// the hosted function and are reported as unavailable.

import {
  type AiProviderEndpoint,
  resolveAiProviderEndpoint,
} from "./ai-provider-endpoint.ts";
import { clampSms } from "./sms-commands.ts";

export type SmsBackend = {
  id: string;
  name: string;
  provider: string;
  base_url: string;
  model: string;
  extra: Record<string, unknown> | null;
};

export type AssistantTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<string>;
};

export type AssistantTurn = { role: "owner" | "assistant"; text: string };

export type AssistantResult =
  | { ok: true; text: string; toolCalls: string[]; rounds: number }
  | { ok: false; error: string; code: string };

export const SMS_ASSISTANT_SYSTEM = `You are the SMS assistant for one MyPersonas / AliaSpaces owner. You are texting with the account owner on their verified phone.

You can: answer questions about the owner's personas (voice, purpose, audience, topics, limits) and their automation configuration (agent board, research, content plans, quiet hours, pause state); list what is waiting for approval; and apply an approval decision when the owner clearly asks for one.

Rules:
- Use the tools for facts. Never guess a setting or invent a persona.
- Only call decide_approval when the owner has clearly told you to approve, reject, or request an edit on a specific item. If the item is ambiguous, ask which code they mean.
- You cannot schedule, publish, change settings, or connect providers. If asked, say it must be done in the app.
- This is SMS. Reply in plain text, no markdown, under 500 characters unless listing items. Lead with the answer.
- Never reveal API keys, tokens, provider account ids, or fan messages; you do not have them.`;

const MAX_ROUNDS = 4;
const MAX_TOKENS = 450;
const TEMPERATURE = 0.3;

function normalizeProvider(value: string) {
  return String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
}

type OpenAiMessage =
  | { role: "system" | "user" | "assistant"; content: string; tool_calls?: unknown[] }
  | { role: "tool"; tool_call_id: string; content: string };

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: string | AnthropicBlock[] };

async function callProvider(
  endpoint: AiProviderEndpoint, apiKey: string, body: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (endpoint.kind === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (endpoint.kind === "azure") headers["api-key"] = apiKey;
  else headers.Authorization = `Bearer ${apiKey}`;
  let response: Response;
  try {
    response = await fetch(endpoint.url, {
      method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(40_000),
    });
  } catch (error) {
    return { ok: false, error: `Model request failed: ${(error as Error).message}` };
  }
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !data) {
    const detail = data && typeof data.error === "object" && data.error
      ? String((data.error as Record<string, unknown>).message || "")
      : "";
    return { ok: false, error: `Model returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}` };
  }
  return { ok: true, data };
}

async function runTool(tools: AssistantTool[], name: string, args: unknown, log: string[]) {
  const tool = tools.find((candidate) => candidate.name === name);
  log.push(name);
  if (!tool) return JSON.stringify({ error: `Unknown tool ${name}` });
  const input = args && typeof args === "object" && !Array.isArray(args)
    ? args as Record<string, unknown>
    : {};
  try {
    return (await tool.run(input)).slice(0, 12_000);
  } catch (error) {
    return JSON.stringify({ error: (error as Error).message.slice(0, 300) });
  }
}

export async function runSmsAssistant(input: {
  backend: SmsBackend;
  apiKey: string;
  history: AssistantTurn[];
  message: string;
  tools: AssistantTool[];
  systemSuffix?: string;
}): Promise<AssistantResult> {
  const provider = normalizeProvider(input.backend.provider);
  if (["localfleet", "ollama", "lmstudio", "elevenlabs"].includes(provider)) {
    return { ok: false, code: "backend_unreachable", error: "Your SMS assistant model runs locally and cannot be reached from the hosted channel. Assign a hosted model for SMS in the app." };
  }
  const endpoint = resolveAiProviderEndpoint({
    provider: input.backend.provider, baseUrl: input.backend.base_url, extra: input.backend.extra,
  });
  if (!("url" in endpoint)) return { ok: false, code: endpoint.code, error: endpoint.error };
  if (!input.apiKey) return { ok: false, code: "backend_key_missing", error: "The assigned model has no saved API key." };
  const model = String(input.backend.model || "").trim();
  if (endpoint.kind !== "azure" && !model) {
    return { ok: false, code: "backend_model_missing", error: "The assigned model has no model name." };
  }
  const system = SMS_ASSISTANT_SYSTEM + (input.systemSuffix ? `\n\n${input.systemSuffix}` : "");
  const toolCalls: string[] = [];

  if (endpoint.kind === "anthropic") {
    const messages: AnthropicMessage[] = [];
    for (const turn of input.history) {
      messages.push({ role: turn.role === "owner" ? "user" : "assistant", content: turn.text });
    }
    // Anthropic requires alternation and a leading user turn.
    const merged: AnthropicMessage[] = [];
    for (const message of [...messages, { role: "user" as const, content: input.message }]) {
      const last = merged[merged.length - 1];
      if (last && last.role === message.role && typeof last.content === "string" && typeof message.content === "string") {
        last.content = `${last.content}\n${message.content}`;
      } else merged.push({ ...message });
    }
    while (merged.length && merged[0].role !== "user") merged.shift();
    const tools = input.tools.map((tool) => ({
      name: tool.name, description: tool.description, input_schema: tool.parameters,
    }));
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const result = await callProvider(endpoint, input.apiKey, {
        model, system, messages: merged, tools, max_tokens: MAX_TOKENS, temperature: TEMPERATURE,
      });
      if (!result.ok) return { ok: false, code: "provider_error", error: result.error };
      const content = Array.isArray(result.data.content) ? result.data.content as AnthropicBlock[] : [];
      const uses = content.filter((block) => block.type === "tool_use") as Extract<AnthropicBlock, { type: "tool_use" }>[];
      if (!uses.length || round === MAX_ROUNDS) {
        const text = content.filter((block) => block.type === "text")
          .map((block) => (block as { text: string }).text).join("\n").trim();
        return { ok: true, text: clampSms(text || "Done."), toolCalls, rounds: round };
      }
      merged.push({ role: "assistant", content });
      const results: AnthropicBlock[] = [];
      for (const use of uses) {
        results.push({ type: "tool_result", tool_use_id: use.id, content: await runTool(input.tools, use.name, use.input, toolCalls) });
      }
      merged.push({ role: "user", content: results });
    }
  } else {
    const messages: OpenAiMessage[] = [{ role: "system", content: system }];
    for (const turn of input.history) {
      messages.push({ role: turn.role === "owner" ? "user" : "assistant", content: turn.text });
    }
    messages.push({ role: "user", content: input.message });
    const tools = input.tools.map((tool) => ({
      type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }));
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const result = await callProvider(endpoint, input.apiKey, {
        ...(endpoint.kind === "azure" ? {} : { model }),
        messages, tools, tool_choice: "auto", max_tokens: MAX_TOKENS, temperature: TEMPERATURE,
      });
      if (!result.ok) return { ok: false, code: "provider_error", error: result.error };
      const choice = Array.isArray(result.data.choices) ? result.data.choices[0] as Record<string, unknown> : null;
      const message = choice && typeof choice.message === "object" ? choice.message as Record<string, unknown> : null;
      const calls = message && Array.isArray(message.tool_calls) ? message.tool_calls as Record<string, unknown>[] : [];
      if (!calls.length || round === MAX_ROUNDS) {
        const text = typeof message?.content === "string" ? message.content.trim() : "";
        return { ok: true, text: clampSms(text || "Done."), toolCalls, rounds: round };
      }
      messages.push({ role: "assistant", content: typeof message?.content === "string" ? message.content : "", tool_calls: calls });
      for (const call of calls) {
        const fn = call.function && typeof call.function === "object" ? call.function as Record<string, unknown> : {};
        let args: unknown = {};
        try { args = JSON.parse(String(fn.arguments || "{}")); } catch { args = {}; }
        messages.push({
          role: "tool", tool_call_id: String(call.id || ""),
          content: await runTool(input.tools, String(fn.name || ""), args, toolCalls),
        });
      }
    }
  }
  return { ok: false, code: "assistant_loop_exhausted", error: "The assistant could not finish." };
}

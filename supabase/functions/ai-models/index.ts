// Lists the models a hosted provider exposes for one of the owner's saved AI
// backends (or for a not-yet-saved provider + key during setup). The endpoint
// is derived from the same reviewed host policy the persona text proxy uses, so
// this function can never reach a host the proxy could not. Keys are read from
// the Vault for saved backends and are never returned or logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
import { requireAal2 } from "../_shared/aal2.ts";
import { resolveAiProviderModelsEndpoint } from "../_shared/ai-provider-endpoint.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);
const ALLOWED_ORIGINS = new Set([
  "https://aliaspaces.com",
  "https://www.aliaspaces.com",
  "https://app.aliaspaces.com",
  "https://mypersonas.online",
  "https://www.mypersonas.online",
]);
const MAX_REQUEST_BYTES = 8_192;
const MAX_PROVIDER_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_MODELS = 500;
const MAX_MODEL_ID_CHARS = 200;
const PROVIDER_TIMEOUT_MS = 12_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
function json(body: unknown, status: number, origin: string) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      ...(origin && ALLOWED_ORIGINS.has(origin) ? cors(origin) : {}),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function boundedText(source: Request | Response, max: number) {
  const declared = Number(source.headers.get("content-length") || 0);
  if (!Number.isSafeInteger(declared) || declared < 0 || declared > max) throw new Error("too_large");
  if (!source.body) return "";
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) throw new Error("too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function vaultKey(backendId: string, owner: string): Promise<string> {
  const { data, error } = await admin.rpc("ai_backend_get_key", { p_backend_id: backendId, p_owner: owner });
  if (error) return "";
  const pick = (value: unknown): string => {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.length ? pick(value[0]) : "";
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      return pick(record.api_key ?? record.key ?? record.secret ?? "");
    }
    return "";
  };
  return pick(data);
}

type ModelEntry = { id: string; label: string };

/** Normalise OpenAI-style `{data:[{id}]}`, Anthropic `{data:[{id,display_name}]}`, and Azure `{data:[{id}]}`. */
function normaliseModels(raw: unknown): ModelEntry[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)
    ? (raw as { data: unknown[] }).data
    : Array.isArray(raw)
    ? raw
    : [];
  const seen = new Set<string>();
  const out: ModelEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id || id.length > MAX_MODEL_ID_CHARS || /[\u0000-\u001f\u007f]/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const name = typeof record.display_name === "string"
      ? record.display_name
      : typeof record.name === "string"
      ? record.name
      : id;
    out.push({ id, label: String(name).slice(0, MAX_MODEL_ID_CHARS) });
    if (out.length >= MAX_MODELS) break;
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403, "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method_not_supported" }, 405, origin);

  const guard = await requireAal2(req, admin);
  if (!guard.ok) return json({ error: guard.error, code: guard.code }, guard.status, origin);
  const owner = guard.user.id;

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(await boundedText(req, MAX_REQUEST_BYTES));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    body = parsed;
  } catch {
    return json({ error: "invalid_request" }, 400, origin);
  }

  // Two shapes: a saved backend (key from Vault) or a setup-time probe where the
  // owner is about to save this exact provider/base/key through create_ai_backend.
  let provider: unknown, baseUrl: unknown, extra: Record<string, unknown> | null = null, apiKey = "";
  if (typeof body.backendId === "string") {
    if (!UUID.test(body.backendId)) return json({ error: "invalid_backend" }, 400, origin);
    const row = await admin.from("ai_backends")
      .select("id,owner,provider,base_url,api_key,extra")
      .eq("id", body.backendId).eq("owner", owner).maybeSingle();
    if (row.error) return json({ error: "backend_unavailable" }, 503, origin);
    if (!row.data) return json({ error: "backend_not_found" }, 404, origin);
    provider = row.data.provider;
    baseUrl = row.data.base_url;
    extra = (row.data.extra && typeof row.data.extra === "object") ? row.data.extra as Record<string, unknown> : null;
    const legacy = typeof row.data.api_key === "string" ? row.data.api_key.trim() : "";
    apiKey = legacy || await vaultKey(row.data.id, owner);
  } else {
    provider = body.provider;
    baseUrl = body.baseUrl;
    extra = (body.extra && typeof body.extra === "object" && !Array.isArray(body.extra)) ? body.extra as Record<string, unknown> : null;
    apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (apiKey.length > 4_096) return json({ error: "invalid_key" }, 400, origin);
  }

  const endpoint = resolveAiProviderModelsEndpoint({ provider, baseUrl, extra });
  if ("error" in endpoint) return json({ error: endpoint.error, code: endpoint.code }, 400, origin);
  if (!endpoint.listable) return json({ provider: endpoint.provider, listable: false, models: [] }, 200, origin);
  if (!apiKey) return json({ error: "A provider API key is required to list models.", code: "key_missing" }, 400, origin);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (endpoint.kind === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (endpoint.kind === "azure") {
    headers["api-key"] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(endpoint.url, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel().catch(() => undefined);
      return json({ error: "The provider rejected this key.", code: "provider_unauthorized" }, 400, origin);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return json({ error: "The provider could not list models right now.", code: "provider_error" }, 502, origin);
    }
    const models = normaliseModels(JSON.parse(await boundedText(response, MAX_PROVIDER_RESPONSE_BYTES)));
    return json({ provider: endpoint.provider, listable: true, models, fetched_at: new Date().toISOString() }, 200, origin);
  } catch {
    return json({ error: "The provider did not answer in time.", code: "provider_unreachable" }, 502, origin);
  }
});

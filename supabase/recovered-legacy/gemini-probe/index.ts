import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const U = Deno.env.get("SUPABASE_URL")!, S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, A = Deno.env.get("SUPABASE_ANON_KEY")!;
const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://mypersonas.online", "Access-Control-Allow-Headers": "authorization,content-type" };
const J = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: H });
async function call(u: string, body: unknown) {
  try {
    const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) });
    const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch { /**/ }
    return { s: r.status, j, t };
  } catch (e) { return { s: 0, j: {} as any, t: String(e) }; }
}
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "POST") return J(405, { e: "post" });
  const uc = createClient(U, A, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
  const { data: ud } = await uc.auth.getUser(); const uid = ud?.user?.id || ""; if (!uid) return J(401, { e: "auth" });
  const svc = createClient(U, S, { auth: { persistSession: false } });
  const { data: b } = await svc.from("ai_backends").select("id,model,base_url,api_key").eq("owner", uid).eq("provider", "google").maybeSingle();
  if (!b) return J(409, { e: "no google backend" });
  let key = String(b.api_key || "");
  if (!key) { const { data: k } = await svc.rpc("ai_backend_get_key", { p_backend_id: b.id, p_owner: uid }); key = String(k || ""); }
  if (!key) return J(409, { e: "no key" });
  const nb = String(b.base_url || "").replace(/\/openai$/, "").replace(/\/+$/, "");
  const m = String(b.model || "gemini-1.5-pro"), kq = encodeURIComponent(key);
  const g = await call(`${nb}/models/${m}:generateContent?key=${kq}`, { contents: [{ parts: [{ text: "One notable AI news item from the last few weeks, with its source." }] }], tools: [{ google_search_retrieval: {} }] });
  const gc = g.j?.candidates?.[0];
  const grounding = { s: g.s, grounded: !!gc?.groundingMetadata, sources: (gc?.groundingMetadata?.groundingChunks || []).length, txt: (gc?.content?.parts?.[0]?.text || g.t || "").slice(0, 160) };
  const im = await call(`${nb}/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${kq}`, { contents: [{ parts: [{ text: "Generate an image: a friendly cartoon robot mascot, flat vector." }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } });
  const ip = (im.j?.candidates?.[0]?.content?.parts || []).find((p: any) => p?.inlineData?.data);
  const image = { s: im.s, ok: !!ip, bytes: ip ? ip.inlineData.data.length : 0, err: ip ? "" : (im.j?.error?.message || im.t || "").slice(0, 160) };
  return J(200, { model: m, grounding, image });
});

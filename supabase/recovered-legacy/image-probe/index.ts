import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const U = Deno.env.get("SUPABASE_URL")!, S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, A = Deno.env.get("SUPABASE_ANON_KEY")!;
const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://mypersonas.online", "Access-Control-Allow-Headers": "authorization,content-type" };
const J = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: H });
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  const uc = createClient(U, A, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
  const { data: ud } = await uc.auth.getUser(); const uid = ud?.user?.id || ""; if (!uid) return J(401, { e: "auth" });
  const svc = createClient(U, S, { auth: { persistSession: false } });
  const { data: b } = await svc.from("ai_backends").select("id,base_url,api_key").eq("owner", uid).eq("provider", "google").maybeSingle();
  if (!b) return J(409, { e: "no google backend" });
  let key = String(b.api_key || "");
  if (!key) { const { data: k } = await svc.rpc("ai_backend_get_key", { p_backend_id: b.id, p_owner: uid }); key = String(k || ""); }
  const nb = String(b.base_url || "").replace(/\/openai$/, "").replace(/\/+$/, ""), kq = encodeURIComponent(key);
  const models = ["nano-banana-pro-preview", "gemini-2.5-flash-image-preview", "gemini-3-pro-image-preview"];
  const out: any[] = [];
  for (const m of models) {
    try {
      const r = await fetch(`${nb}/models/${m}:generateContent?key=${kq}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "A cute friendly robot mascot, flat vector illustration, centered, square." }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
        signal: AbortSignal.timeout(60000),
      });
      const j: any = await r.json().catch(() => ({}));
      const part = (j?.candidates?.[0]?.content?.parts || []).find((p: any) => p?.inlineData?.data);
      out.push({ model: m, status: r.status, ok: !!part, mime: part?.inlineData?.mimeType || null, bytes: part ? part.inlineData.data.length : 0, err: part ? "" : String(j?.error?.message || JSON.stringify(j)).slice(0, 180) });
      if (part) break;
    } catch (e) { out.push({ model: m, err: String(e).slice(0, 120) }); }
  }
  return J(200, { results: out });
});

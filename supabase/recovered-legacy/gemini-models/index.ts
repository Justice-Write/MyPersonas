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
  const { data: b } = await svc.from("ai_backends").select("id,model,base_url,api_key").eq("owner", uid).eq("provider", "google").maybeSingle();
  if (!b) return J(409, { e: "no backend" });
  let key = String(b.api_key || "");
  if (!key) { const { data: k } = await svc.rpc("ai_backend_get_key", { p_backend_id: b.id, p_owner: uid }); key = String(k || ""); }
  if (!key) return J(409, { e: "no key" });
  const nb = String(b.base_url || "").replace(/\/openai$/, "").replace(/\/+$/, ""), kq = encodeURIComponent(key);
  let gen: string[] = [], img: string[] = [], listErr = "";
  try {
    const r = await fetch(`${nb}/models?key=${kq}&pageSize=1000`, { signal: AbortSignal.timeout(30000) });
    const j: any = await r.json();
    if (!r.ok) listErr = JSON.stringify(j).slice(0, 200);
    for (const m of (j.models || [])) {
      const n = String(m.name || "").replace("models/", ""); const meths = m.supportedGenerationMethods || [];
      if (meths.includes("predict") || /image/i.test(n)) img.push(n);
      else if (meths.includes("generateContent")) gen.push(n);
    }
  } catch (e) { listErr = String(e); }
  let text: any = {};
  try {
    const r = await fetch(`${String(b.base_url).replace(/\/+$/, "")}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: b.model, messages: [{ role: "user", content: "Reply BRAIN_OK" }], max_tokens: 20 }), signal: AbortSignal.timeout(30000),
    });
    const t = await r.text(); text = { s: r.status, sample: t.slice(0, 140) };
  } catch (e) { text = { err: String(e) }; }
  return J(200, { configured: b.model, textOpenAICompat: text, generateContentModels: gen.slice(0, 60), imageModels: img.slice(0, 40), listErr });
});

// daily-discovery - each persona researches its focus areas via Gemini Google-Search
// grounding, dedupes against what it already knows, and files "did you know?" items
// into discovery_questions for the owner. Research only - writes no posts, never
// publishes. Owner-bearer runs for the caller; X-Cron-Secret runs all owners.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const U = Deno.env.get("SUPABASE_URL")!, S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, A = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON = Deno.env.get("CRON_SECRET") || "";
const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://mypersonas.online", "Access-Control-Allow-Headers": "authorization,content-type,x-cron-secret" };
const J = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: H });
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

async function grounded(nb: string, model: string, key: string, prompt: string) {
  const url = `${nb}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body = (tool: string) => ({ contents: [{ parts: [{ text: prompt }] }], tools: [{ [tool]: {} }] });
  const send = async (tool: string) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body(tool)), signal: AbortSignal.timeout(45000) });
    return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({} as any)) };
  };
  let res = await send("google_search");
  if (!res.ok && /not supported|google_search|invalid/i.test(JSON.stringify(res.j))) res = await send("google_search_retrieval");
  const cand = (res.j as any)?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p: any) => p?.text || "").join("");
  const sources = ((cand?.groundingMetadata?.groundingChunks) || []).map((c: any) => c?.web?.uri).filter(Boolean);
  return { ok: res.ok, status: res.status, text, sources, err: res.ok ? "" : clip((res.j as any)?.error?.message || JSON.stringify(res.j), 200) };
}

function parseFindings(text: string): any[] {
  let t = String(text || "").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  const a = t.indexOf("["), b = t.lastIndexOf("]");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { const v = JSON.parse(t); return Array.isArray(v) ? v : []; } catch { return []; }
}

async function discoverForOwner(svc: any, uid: string, opts: { personaId?: string; perPersona?: number; maxPersonas?: number }) {
  const per = Math.max(1, Math.min(5, opts.perPersona || 3));
  const { data: backend } = await svc.from("ai_backends").select("id,model,base_url,api_key").eq("owner", uid).eq("provider", "google").maybeSingle();
  if (!backend) return { error: "no google backend" };
  let key = String(backend.api_key || "");
  if (!key) { const { data: k } = await svc.rpc("ai_backend_get_key", { p_backend_id: backend.id, p_owner: uid }); key = String(k || ""); }
  if (!key) return { error: "gemini key unreadable" };
  const nb = String(backend.base_url || "").replace(/\/openai$/, "").replace(/\/+$/, ""), model = String(backend.model || "gemini-flash-latest");

  let planQ = svc.from("persona_content_plans").select("persona_id,content_pillars,source_notes,audience_focus").eq("owner", uid);
  if (opts.personaId) planQ = planQ.eq("persona_id", opts.personaId);
  const { data: plans } = await planQ;
  const eligible = (plans || []).filter((p: any) => clip(p.content_pillars, 3).trim()).slice(0, opts.maxPersonas || 8);
  if (!eligible.length) return { personas: 0, created: 0, note: "no personas have content pillars set" };

  const ids = eligible.map((p: any) => p.persona_id);
  const { data: pers } = await svc.from("personas").select("id,name").in("id", ids);
  const nameOf: Record<string, string> = {}; (pers || []).forEach((p: any) => nameOf[p.id] = p.name);

  const out: any[] = []; let created = 0;
  for (const plan of eligible) {
    const pid = plan.persona_id, name = nameOf[pid] || "this persona";
    const prompt = `You are the research assistant for a social media persona named "${name}". Its focus areas: ${clip(plan.content_pillars, 1000)}. ${clip(plan.source_notes, 600) ? "Preferred sources/notes: " + clip(plan.source_notes, 600) + ". " : ""}Using current web search, find up to ${per} NOTABLE, RECENT (last ~2 weeks) developments in these focus areas worth posting about. Return ONLY a JSON array; each item: {"topic":"short label","finding":"one punchy sentence","summary":"2-3 sentences on what it is and why it matters","sources":["url","url"]}. No prose outside the JSON.`;
    const g = await grounded(nb, model, key, prompt);
    if (!g.ok) { out.push({ persona: name, ok: false, status: g.status, err: g.err }); continue; }
    const findings = parseFindings(g.text).slice(0, per);
    const { data: existing } = await svc.from("discovery_questions").select("finding").eq("owner", uid).eq("persona_id", pid).in("status", ["pending", "known"]);
    const seen = new Set((existing || []).map((e: any) => clip(e.finding, 4000).toLowerCase().trim()));
    let n = 0;
    for (const f of findings) {
      const finding = clip(f?.finding, 4000).trim();
      if (!finding || seen.has(finding.toLowerCase())) continue;
      const srcs = Array.isArray(f?.sources) && f.sources.length ? f.sources.filter(Boolean).slice(0, 6) : g.sources.slice(0, 6);
      const ins = await svc.from("discovery_questions").insert({
        owner: uid, persona_id: pid, topic: clip(f?.topic, 200), finding, summary: clip(f?.summary, 2000),
        source_urls: srcs, status: "pending",
      });
      if (!ins.error) { n++; created++; seen.add(finding.toLowerCase()); }
    }
    out.push({ persona: name, ok: true, created: n });
  }
  return { personas: eligible.length, created, details: out };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "POST") return J(405, { error: "POST only" });
  const svc = createClient(U, S, { auth: { persistSession: false } });
  let body: any = {}; try { body = await req.json(); } catch { /**/ }

  const cronHdr = req.headers.get("X-Cron-Secret") || "";
  if (cronHdr && CRON && cronHdr === CRON && body.action === "discover_all") {
    const { data: owners } = await svc.from("persona_content_plans").select("owner");
    const uniq = [...new Set((owners || []).map((o: any) => o.owner))].slice(0, 200);
    const results: any[] = [];
    for (const uid of uniq) results.push({ owner: String(uid).slice(0, 8), ...(await discoverForOwner(svc, uid, { perPersona: body.perPersona, maxPersonas: body.maxPersonas })) });
    return J(200, { mode: "cron", owners: uniq.length, results });
  }

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return J(401, { error: "sign in" });
  const uc = createClient(U, A, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ud } = await uc.auth.getUser();
  const uid = ud?.user?.id || "";
  if (!uid) return J(401, { error: "sign in" });
  const result = await discoverForOwner(svc, uid, { personaId: body.personaId, perPersona: body.perPersona, maxPersonas: body.maxPersonas });
  return J(200, result);
});

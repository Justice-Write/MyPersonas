// split-post - turn ONE idea into a per-platform draft (X / Facebook / Instagram),
// each with its own on-brand caption (Gemini) + its own image (nano-banana), linked
// by drafts.idea_group_id. Creates PENDING drafts only - never approves or publishes.
// Input: { questionId } (a discovery item) OR { personaId, topic, finding, summary, sources[] }.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const U = Deno.env.get("SUPABASE_URL")!, S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, A = Deno.env.get("SUPABASE_ANON_KEY")!;
const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://mypersonas.online", "Access-Control-Allow-Headers": "authorization,content-type" };
const J = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: H });
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const BUCKET = "persona-media";

const SPEC: Record<string, { label: string; max: number; guide: string; aspect: string }> = {
  twitter: { label: "X (Twitter)", max: 280, guide: "One punchy hook under 280 characters, at most 1-2 hashtags, no fluff.", aspect: "wide 16:9 landscape" },
  facebook: { label: "Facebook Page", max: 1800, guide: "2-3 short paragraphs explaining what it is and why it matters, warm tone, end with a light call to action.", aspect: "square 1:1" },
  instagram: { label: "Instagram", max: 2000, guide: "Visual-first caption with a scroll-stopping first line and 5-9 relevant hashtags at the end. No bare links.", aspect: "square 1:1" },
};

async function gJson(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({} as any)) };
}
async function genText(nb: string, model: string, kq: string, prompt: string) {
  const r = await gJson(`${nb}/models/${model}:generateContent?key=${kq}`, { contents: [{ parts: [{ text: prompt }] }] });
  return (r.j?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
}
async function genImage(nb: string, kq: string, prompt: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const r = await gJson(`${nb}/models/nano-banana-pro-preview:generateContent?key=${kq}`, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } });
  const part = (r.j?.candidates?.[0]?.content?.parts || []).find((p: any) => p?.inlineData?.data);
  if (!part) return null;
  const bin = atob(part.inlineData.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime: part.inlineData.mimeType || "image/jpeg" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "POST") return J(405, { error: "POST only" });
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return J(401, { error: "sign in" });
  const uc = createClient(U, A, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ud } = await uc.auth.getUser();
  const uid = ud?.user?.id || "";
  if (!uid) return J(401, { error: "sign in" });
  const svc = createClient(U, S, { auth: { persistSession: false } });
  let body: any = {}; try { body = await req.json(); } catch { /**/ }

  // Resolve the idea.
  let personaId = String(body.personaId || ""), topic = clip(body.topic, 200), finding = clip(body.finding, 4000), summary = clip(body.summary, 2000);
  let sources: string[] = Array.isArray(body.sources) ? body.sources : [];
  let questionId = String(body.questionId || "");
  if (questionId) {
    const { data: q } = await svc.from("discovery_questions").select("*").eq("id", questionId).eq("owner", uid).maybeSingle();
    if (!q) return J(404, { error: "discovery item not found" });
    personaId = q.persona_id; topic = clip(q.topic, 200); finding = clip(q.finding, 4000); summary = clip(q.summary, 2000);
    sources = Array.isArray(q.source_urls) ? q.source_urls : [];
  }
  if (!personaId || !finding) return J(400, { error: "need personaId + finding (or a questionId)" });

  const { data: persona } = await svc.from("personas").select("id,name").eq("id", personaId).eq("owner", uid).maybeSingle();
  if (!persona) return J(404, { error: "persona not found" });
  const { data: plan } = await svc.from("persona_content_plans").select("content_pillars,audience_focus,platform_guidance,calls_to_action").eq("persona_id", personaId).eq("owner", uid).maybeSingle();

  const { data: backend } = await svc.from("ai_backends").select("id,model,base_url,api_key").eq("owner", uid).eq("provider", "google").maybeSingle();
  if (!backend) return J(409, { error: "no google backend" });
  let key = String(backend.api_key || "");
  if (!key) { const { data: k } = await svc.rpc("ai_backend_get_key", { p_backend_id: backend.id, p_owner: uid }); key = String(k || ""); }
  if (!key) return J(409, { error: "gemini key unreadable" });
  const nb = String(backend.base_url || "").replace(/\/openai$/, "").replace(/\/+$/, ""), model = String(backend.model || "gemini-flash-latest"), kq = encodeURIComponent(key);

  // Target: one connected account per platform for this persona.
  const { data: ledgers } = await svc.from("account_ledger").select("id,provider,username").eq("owner", uid).eq("persona_id", personaId).in("provider", ["twitter", "facebook", "instagram"]);
  const ids = (ledgers || []).map((l: any) => l.id);
  const { data: conns } = await svc.from("account_connections").select("ledger_id,connection_state").in("ledger_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const connected = new Set((conns || []).filter((c: any) => c.connection_state === "connected").map((c: any) => c.ledger_id));
  const targets: any[] = [];
  const seen = new Set<string>();
  for (const l of (ledgers || [])) { if (connected.has(l.id) && !seen.has(l.provider)) { seen.add(l.provider); targets.push(l); } }
  if (!targets.length) return J(409, { error: `${persona.name} has no connected X/Facebook/Instagram accounts to draft for` });

  await svc.storage.createBucket(BUCKET, { public: true }).catch(() => undefined);

  const group = crypto.randomUUID();
  const voice = `Persona voice: "${persona.name}". Focus/pillars: ${clip(plan?.content_pillars, 800)}. Audience: ${clip(plan?.audience_focus, 400)}. ${clip(plan?.platform_guidance, 500) ? "Platform notes: " + clip(plan?.platform_guidance, 500) + ". " : ""}${clip(plan?.calls_to_action, 300) ? "CTA options: " + clip(plan?.calls_to_action, 300) + "." : ""}`;

  const results = await Promise.all(targets.map(async (t: any) => {
    const spec = SPEC[t.provider];
    try {
      const captionPrompt = `You are writing AS the persona. ${voice}\nWrite a ${spec.label} post about this development: "${finding}".\nContext: ${summary}\n${sources[0] ? "Source to reference naturally: " + sources[0] : ""}\nRules: ${spec.guide} Stay under ${spec.max} characters. Write in the persona's authentic voice. Return ONLY the post text - no quotes, no preamble, no explanation.`;
      const imgPrompt = `A high-quality editorial social-media image for a post about: ${finding}. Mood/topic: ${topic}. Aesthetic fitting the persona "${persona.name}" (${clip(plan?.content_pillars, 200)}). ${spec.aspect} composition. Clean, striking, NO text, NO watermark, NO logos.`;
      const [caption, img] = await Promise.all([genText(nb, model, kq, captionPrompt), genImage(nb, kq, imgPrompt)]);
      let mediaUrl = "";
      if (img) {
        const path = `${uid}/${group}/${t.provider}.jpg`;
        const up = await svc.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.mime, upsert: true });
        if (!up.error) mediaUrl = `${U}/storage/v1/object/public/${BUCKET}/${path}`;
      }
      const { data: draft, error: derr } = await svc.from("drafts").insert({
        owner: uid, persona_id: personaId, account_id: t.id, platform: t.provider, content_kind: "post",
        status: "idea", approval_state: "pending", publish_state: "not_queued",
        title: clip(topic || finding, 120), body: clip(caption || finding, spec.max), tags: "",
        media_url: mediaUrl, idea_group_id: group,
      }).select("id").maybeSingle();
      if (derr) return { platform: t.provider, ok: false, error: derr.message };
      return { platform: t.provider, ok: true, draftId: draft?.id || "", account: t.username, hasImage: !!mediaUrl, caption: clip(caption, 140) };
    } catch (e) { return { platform: t.provider, ok: false, error: String(e).slice(0, 160) }; }
  }));

  if (questionId) {
    await svc.from("discovery_questions").update({ status: "drafted", draft_group_id: group, answered_at: new Date().toISOString() }).eq("id", questionId).eq("owner", uid);
    await svc.from("persona_knowledge").insert({ owner: uid, persona_id: personaId, topic, fact: finding, source_url: sources[0] || "", status: "known", origin: "discovery" }).catch?.(() => undefined);
  }
  return J(200, { group, persona: persona.name, drafts: results });
});

// meta-ig-discover - READ-ONLY. For each owner-connected Facebook Page, use the
// stored shared grant to report the token's REAL scopes (/debug_token) and the
// linked professional Instagram account. Publishes nothing, writes nothing.
// Deploy WITH JWT verification.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const U = Deno.env.get("SUPABASE_URL")!;
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const A = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP = Deno.env.get("META_APP_ID") || "";
const SEC = Deno.env.get("META_APP_SECRET") || "";
const V = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://mypersonas.online",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const J = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
async function proof(t: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SEC), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(t)));
  return [...s].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function g(path: string, tok: string, params: Record<string, string> = {}) {
  const u = new URL(`https://graph.facebook.com/${V}${path}`);
  const q = new URLSearchParams(params);
  q.set("access_token", tok);
  q.set("appsecret_proof", await proof(tok));
  u.search = q.toString();
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    const p = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, p: p as Record<string, unknown> };
  } catch {
    return { ok: false, status: 0, p: {} as Record<string, unknown> };
  }
}
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return J(405, { error: "POST only" });
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return J(401, { error: "sign in" });
  const uc = createClient(U, A, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ud } = await uc.auth.getUser();
  const uid = ud?.user?.id || "";
  if (!uid) return J(401, { error: "sign in" });
  if (!APP || !SEC) return J(503, { error: "meta creds missing" });
  const svc = createClient(U, S, { auth: { persistSession: false } });
  const { data: rows } = await svc
    .from("meta_page_connections")
    .select("facebook_page_id,facebook_page_name,grant_id,facebook_ledger_id,instagram_ledger_id,instagram_business_id,instagram_username")
    .eq("owner", uid);
  if (!rows || !rows.length) return J(200, { note: "no connections", grants: [], pages: [] });
  const tok = new Map<string, string>();
  const grants: unknown[] = [];
  const appTok = `${APP}|${SEC}`;
  for (const gid of [...new Set(rows.map((r) => String(r.grant_id)).filter(Boolean))]) {
    const { data: gd } = await svc.rpc("meta_get_grant_token_bundle", { p_grant_id: gid, p_owner: uid });
    const row = (Array.isArray(gd) ? gd[0] : gd) as { token_bundle?: { access_token?: string } } | undefined;
    const t = String(row?.token_bundle?.access_token || "");
    if (!t) {
      grants.push({ gid, ok: false });
      continue;
    }
    tok.set(gid, t);
    const d = await g("/debug_token", appTok, { input_token: t });
    const dd = (d.p?.data || {}) as Record<string, unknown>;
    grants.push({ gid, ok: true, scopes: dd.scopes || [], valid: dd.is_valid ?? null });
  }
  const pages: unknown[] = [];
  for (const r of rows) {
    const pid = String(r.facebook_page_id || "");
    const t = tok.get(String(r.grant_id)) || "";
    const o: Record<string, unknown> = {
      page: r.facebook_page_name,
      page_id: pid,
      fb_ledger: r.facebook_ledger_id,
      ig_ledger: r.instagram_ledger_id,
      cur_ig_biz: r.instagram_business_id,
    };
    if (pid && t) {
      const res = await g(`/${pid}`, t, { fields: "instagram_business_account{id,username,name},connected_instagram_account{id,username,name}" });
      if (res.ok) {
        o.linked_ig = res.p?.instagram_business_account || null;
        o.connected_ig = res.p?.connected_instagram_account || null;
      } else {
        o.error = (res.p?.error as Record<string, unknown>)?.message || `HTTP ${res.status}`;
      }
    } else {
      o.error = "no token";
    }
    pages.push(o);
  }
  return J(200, { grants, pages });
});

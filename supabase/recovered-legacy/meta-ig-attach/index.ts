// meta-ig-attach - one-shot wiring so an existing, already-working Facebook Page
// grant can publish to its linked professional Instagram, WITHOUT repeating the
// Meta re-authorization flow. Validates ownership, then:
//   1. upserts account_connections (IG ledger -> connected)
//   2. sets meta_page_connections.instagram_ledger_id/business_id/username
//   3. inserts ONE approved Instagram test draft and returns its id
// Deploy WITH JWT verification.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const U = Deno.env.get("SUPABASE_URL")!;
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const A = Deno.env.get("SUPABASE_ANON_KEY")!;
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://mypersonas.online",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const J = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return J(405, { error: "POST only" });
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return J(401, { error: "sign in" });
  const uc = createClient(U, A, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ud } = await uc.auth.getUser();
  const uid = ud?.user?.id || "";
  if (!uid) return J(401, { error: "sign in" });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const ledgerId = String(body.ledgerId || "");
  const pageId = String(body.pageId || "");
  const igBusinessId = String(body.igBusinessId || "");
  const igUsername = String(body.igUsername || "");
  const imageUrl = String(body.imageUrl || "");
  const caption = String(body.caption || "");
  const makeDraft = body.makeDraft !== false;
  if (!ledgerId || !pageId || !igBusinessId) return J(400, { error: "ledgerId, pageId, igBusinessId required" });
  if (makeDraft && !/^https:\/\//i.test(imageUrl)) return J(400, { error: "https imageUrl required for the test draft" });

  const svc = createClient(U, S, { auth: { persistSession: false } });

  // Validate the IG ledger belongs to this owner.
  const { data: ledger } = await svc.from("account_ledger")
    .select("id,owner,provider,persona_id,username").eq("id", ledgerId).eq("owner", uid).maybeSingle();
  if (!ledger || ledger.provider !== "instagram") return J(409, { error: "IG ledger not found for this owner" });

  // Validate the page connection belongs to this owner.
  const { data: pageRow } = await svc.from("meta_page_connections")
    .select("facebook_page_id,owner,grant_id,facebook_ledger_id").eq("owner", uid).eq("facebook_page_id", pageId).maybeSingle();
  if (!pageRow) return J(409, { error: "Page connection not found for this owner" });

  // 1. account_connections for the IG ledger -> connected (insert or update).
  const nowIso = new Date().toISOString();
  const { data: existingConn } = await svc.from("account_connections")
    .select("ledger_id").eq("ledger_id", ledgerId).maybeSingle();
  const connRow = {
    ledger_id: ledgerId,
    owner: uid,
    provider: "instagram",
    provider_subject: igBusinessId,
    provider_email: "",
    granted_scopes: ["instagram_basic", "instagram_content_publish", "pages_manage_posts", "pages_read_engagement", "pages_show_list", "public_profile"],
    connection_state: "connected",
    verification_method: "meta_facebook_login_pages",
    verified_at: nowIso,
    connected_at: nowIso,
    last_checked_at: nowIso,
    error_code: "",
  };
  const connWrite = existingConn
    ? await svc.from("account_connections").update(connRow).eq("ledger_id", ledgerId)
    : await svc.from("account_connections").insert(connRow);
  if (connWrite.error) return J(500, { error: "account_connections write failed: " + connWrite.error.message });

  // 2. attach IG to the page connection.
  const { error: mpcErr } = await svc.from("meta_page_connections").update({
    instagram_ledger_id: ledgerId,
    instagram_business_id: igBusinessId,
    instagram_username: igUsername,
    updated_at: nowIso,
  }).eq("owner", uid).eq("facebook_page_id", pageId);
  if (mpcErr) return J(500, { error: "meta_page_connections update failed: " + mpcErr.message });

  // 3. optional approved test draft.
  let draftId = "";
  if (makeDraft) {
    const { data: draft, error: draftErr } = await svc.from("drafts").insert({
      owner: uid,
      persona_id: ledger.persona_id,
      account_id: ledgerId,
      platform: "instagram",
      content_kind: "post",
      status: "idea",
      approval_state: "approved",
      publish_state: "not_queued",
      title: "Instagram setup test",
      body: caption || "Automated setup test.",
      tags: "",
      media_url: imageUrl,
    }).select("id").maybeSingle();
    if (draftErr) return J(500, { error: "draft insert failed: " + draftErr.message });
    draftId = draft?.id || "";
  }

  return J(200, { ok: true, ledgerId, pageId, igBusinessId, igUsername, draftId });
});

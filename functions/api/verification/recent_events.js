import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "30")));

  const r = await env.DB.prepare(`
    SELECT
      al.id,
      al.actor_user_id,
      al.action,
      al.target_type,
      al.target_id,
      al.meta_json,
      al.created_at,
      u.email_norm AS actor_email,
      u.display_name AS actor_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.actor_user_id
    WHERE al.action IN (
      'verification_email_send_requested',
      'verification_email_completed',
      'verification_phone_otp_requested',
      'verification_phone_completed',
      'two_step_enabled',
      'kyc_requested',
      'kyc_submitted',
      'kyc_approved',
      'kyc_rejected',
      'verification_policy_block'
    )
    ORDER BY al.created_at DESC
    LIMIT ?
  `).bind(limit).all();

  const items = (r.results || []).map(row => {
    let meta = {};
    try{ meta = JSON.parse(String(row.meta_json || "{}")); }catch{}
    return {
      ...row,
      meta
    };
  });

  return json(200, "ok", {
    items,
    total: items.length
  });
}

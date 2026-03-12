import { json, requireAuth } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const rows = await env.DB.prepare(`
    SELECT
      id,
      user_id,
      created_at,
      expires_at,
      revoked_at,
      ip_hash,
      ua_hash,
      ip_prefix_hash,
      last_seen_at,
      roles_json,
      session_version,
      revoke_reason
    FROM sessions
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(a.uid).all();

  const items = (rows.results || []).map(x => ({
    id: String(x.id || ""),
    user_id: String(x.user_id || ""),
    created_at: Number(x.created_at || 0),
    expires_at: Number(x.expires_at || 0),
    revoked_at: x.revoked_at == null ? null : Number(x.revoked_at),
    ip_hash: x.ip_hash || null,
    ua_hash: x.ua_hash || null,
    ip_prefix_hash: x.ip_prefix_hash || null,
    last_seen_at: x.last_seen_at == null ? null : Number(x.last_seen_at),
    session_version: Number(x.session_version || 1),
    revoke_reason: x.revoke_reason || null,
    current_session: String(x.id || "") === String(a.sid || "")
  }));

  return json(200, "ok", {
    user: {
      id: a.user?.id || a.uid,
      email_norm: a.user?.email_norm || null,
      display_name: a.user?.display_name || null
    },
    current_sid: a.sid || null,
    session_version: Number(a.user?.session_version || 1),
    items
  });
}

import { json, requireAuth, hasRole } from "../../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const user_id = String(url.searchParams.get("user_id") || "").trim();

  if(!user_id){
    return json(400, "invalid_input", { message:"user_id_required" });
  }

  const user = await env.DB.prepare(`
    SELECT
      id, email_norm, display_name, status,
      session_version, locked_until, lock_reason
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(user_id).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

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
  `).bind(user_id).all();

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
    revoke_reason: x.revoke_reason || null
  }));

  return json(200, "ok", {
    user: {
      id: String(user.id || ""),
      email_norm: user.email_norm || null,
      display_name: user.display_name || null,
      status: user.status || null,
      session_version: Number(user.session_version || 1),
      locked_until: user.locked_until == null ? null : Number(user.locked_until),
      lock_reason: user.lock_reason || null
    },
    items
  });
}

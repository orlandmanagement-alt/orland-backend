import { json, requireAuth, nowSec } from "../../_lib.js";

function canAccessAdmin(roles){
  const s = new Set((roles || []).map(String));
  return s.has("super_admin") || s.has("admin") || s.has("security_admin") || s.has("audit_admin") || s.has("staff");
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;
  if(!canAccessAdmin(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const now = nowSec();
  const dayAgo = now - 86400;

  try{
    const sessionsActive = await env.DB.prepare(`
      SELECT COUNT(*) AS c
      FROM sessions
      WHERE revoked_at IS NULL AND expires_at > ?
    `).bind(now).first();

    const blockedIps = await env.DB.prepare(`
      SELECT COUNT(*) AS c
      FROM ip_blocks
      WHERE revoked_at IS NULL AND expires_at > ?
    `).bind(now).first();

    const lockedUsers = await env.DB.prepare(`
      SELECT COUNT(*) AS c
      FROM users
      WHERE locked_until IS NOT NULL AND locked_until > ?
    `).bind(now).first();

    const audit24h = await env.DB.prepare(`
      SELECT COUNT(*) AS c
      FROM audit_logs
      WHERE created_at >= ?
    `).bind(dayAgo).first();

    const fail24h = await env.DB.prepare(`
      SELECT COUNT(*) AS c
      FROM audit_logs
      WHERE created_at >= ?
        AND action IN ('password_fail','sso_verify_login_challenge_fail')
    `).bind(dayAgo).first();

    return json(200, "ok", {
      summary: {
        active_sessions: Number(sessionsActive?.c || 0),
        active_blocked_ips: Number(blockedIps?.c || 0),
        locked_users: Number(lockedUsers?.c || 0),
        audit_events_24h: Number(audit24h?.c || 0),
        failed_auth_24h: Number(fail24h?.c || 0)
      }
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_security_kpi",
      detail: String(err?.message || err)
    });
  }
}

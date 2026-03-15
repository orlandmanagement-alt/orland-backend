import { requireAuth, nowSec } from "../../_lib.js";

function canAccessAdmin(roles){
  const s = new Set((roles || []).map(String));
  return s.has("super_admin") || s.has("admin") || s.has("audit_admin") || s.has("security_admin") || s.has("staff");
}

function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n]/.test(s)){
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;
  if(!canAccessAdmin(auth.roles || [])){
    return new Response("forbidden", { status: 403 });
  }

  const now = nowSec();
  const dayAgo = now - 86400;

  const failedLogins = await env.DB.prepare(`
    SELECT COUNT(*) AS c
    FROM audit_logs
    WHERE created_at >= ?
      AND action IN ('password_fail','sso_verify_login_challenge_fail','login_mfa_required')
  `).bind(dayAgo).first();

  const loginSuccess = await env.DB.prepare(`
    SELECT COUNT(*) AS c
    FROM audit_logs
    WHERE created_at >= ?
      AND action IN ('login_success','sso_login_success')
  `).bind(dayAgo).first();

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

  const rows = [[
    "failed_logins_24h",
    "login_success_24h",
    "active_blocked_ips",
    "locked_users"
  ].join(","),
  [
    csvEscape(Number(failedLogins?.c || 0)),
    csvEscape(Number(loginSuccess?.c || 0)),
    csvEscape(Number(blockedIps?.c || 0)),
    csvEscape(Number(lockedUsers?.c || 0))
  ].join(",")];

  return new Response(rows.join("\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="auth-risk-monitor.csv"`,
      "cache-control": "no-store"
    }
  });
}

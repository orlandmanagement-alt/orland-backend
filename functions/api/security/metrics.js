import { json, requireAuth, hasRole } from "../../_lib.js";

function nowSec(){
  return Math.floor(Date.now() / 1000);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") || "7")));
  const since = nowSec() - (days * 86400);

  // audit-based metrics
  const audit = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN action='rate_limited' THEN 1 ELSE 0 END),0) AS rate_limited,
      COALESCE(SUM(CASE WHEN action='lockout' THEN 1 ELSE 0 END),0) AS lockouts,
      COALESCE(SUM(CASE WHEN action='otp_verify_fail' THEN 1 ELSE 0 END),0) AS otp_verify_fail,
      COALESCE(SUM(CASE WHEN action='password_fail' THEN 1 ELSE 0 END),0) AS password_fail,
      COALESCE(SUM(CASE WHEN action='session_anomaly' THEN 1 ELSE 0 END),0) AS session_anomaly
    FROM audit_logs
    WHERE created_at >= ?
  `).bind(since).first();

  // incidents created
  const inc = await env.DB.prepare(`
    SELECT COALESCE(COUNT(*),0) AS incidents_created
    FROM incidents
    WHERE created_at >= ?
  `).bind(since).first();

  // active sessions
  const activeSessions = await env.DB.prepare(`
    SELECT COALESCE(COUNT(*),0) AS active_sessions
    FROM sessions
    WHERE revoked_at IS NULL
      AND expires_at > ?
  `).bind(nowSec()).first();

  // otp requests in period
  const otp = await env.DB.prepare(`
    SELECT
      COALESCE(COUNT(*),0) AS otp_requests_total,
      COALESCE(SUM(CASE WHEN consumed_at IS NOT NULL THEN 1 ELSE 0 END),0) AS otp_consumed,
      COALESCE(SUM(CASE WHEN expires_at < ? AND consumed_at IS NULL THEN 1 ELSE 0 END),0) AS otp_expired
    FROM otp_requests
    WHERE created_at >= ?
  `).bind(nowSec(), since).first();

  // alerts state summary
  const alerts = await env.DB.prepare(`
    SELECT
      COALESCE(COUNT(*),0) AS rules_total,
      COALESCE(SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END),0) AS rules_enabled
    FROM alert_rules
  `).first();

  const fired = await env.DB.prepare(`
    SELECT COALESCE(COUNT(*),0) AS rules_fired
    FROM alert_state
    WHERE last_fired_at IS NOT NULL
      AND updated_at >= ?
  `).bind(since).first();

  return json(200,"ok",{
    days,
    source: "audit_logs+incidents+sessions+otp_requests+alert_rules+alert_state",

    rate_limited: Number(audit?.rate_limited || 0),
    lockouts: Number(audit?.lockouts || 0),
    otp_verify_fail: Number(audit?.otp_verify_fail || 0),
    password_fail: Number(audit?.password_fail || 0),
    session_anomaly: Number(audit?.session_anomaly || 0),

    incidents_created: Number(inc?.incidents_created || 0),
    active_sessions: Number(activeSessions?.active_sessions || 0),

    otp_requests_total: Number(otp?.otp_requests_total || 0),
    otp_consumed: Number(otp?.otp_consumed || 0),
    otp_expired: Number(otp?.otp_expired || 0),

    rules_total: Number(alerts?.rules_total || 0),
    rules_enabled: Number(alerts?.rules_enabled || 0),
    rules_fired: Number(fired?.rules_fired || 0)
  });
}

import { json, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function toInt(v, d = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function dayKeyFromSec(sec){
  const d = new Date(Number(sec || 0) * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function scalar(env, sql, binds = []){
  const row = await env.DB.prepare(sql).bind(...binds).first();
  if(!row) return 0;
  const k = Object.keys(row)[0];
  return toInt(row[k], 0);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "staff"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(365, toInt(url.searchParams.get("days"), 7)));
  const now = nowSec();
  const since = now - (days * 86400);
  const sinceDay = dayKeyFromSec(since);

  const [
    rate_limited,
    lockouts,
    otp_verify_fail,
    password_fail,
    session_anomaly,
    incidents_created,
    active_sessions,
    otp_requests_total,
    otp_consumed,
    otp_expired,
    rules_total,
    rules_enabled,
    rules_fired
  ] = await Promise.all([
    scalar(env, `
      SELECT COALESCE(SUM(rate_limited), 0) AS v
      FROM hourly_metrics
      WHERE hour >= ?
    `, [sinceDay]),

    scalar(env, `
      SELECT COALESCE(SUM(lockouts), 0) AS v
      FROM hourly_metrics
      WHERE hour >= ?
    `, [sinceDay]),

    scalar(env, `
      SELECT COALESCE(SUM(otp_verify_fail), 0) AS v
      FROM hourly_metrics
      WHERE hour >= ?
    `, [sinceDay]),

    scalar(env, `
      SELECT COALESCE(SUM(password_fail), 0) AS v
      FROM hourly_metrics
      WHERE hour >= ?
    `, [sinceDay]),

    scalar(env, `
      SELECT COALESCE(SUM(session_anomaly), 0) AS v
      FROM hourly_metrics
      WHERE hour >= ?
    `, [sinceDay]),

    scalar(env, `
      SELECT COUNT(*) AS v
      FROM incidents
      WHERE created_at >= ?
    `, [since]),

    scalar(env, `
      SELECT COUNT(*) AS v
      FROM sessions
      WHERE revoked_at IS NULL
        AND expires_at > ?
    `, [now]),

    scalar(env, `
      SELECT COUNT(*) AS v
      FROM otp_requests
      WHERE created_at >= ?
    `, [since]),

    scalar(env, `
      SELECT COUNT(*) AS v
      FROM otp_requests
      WHERE created_at >= ?
        AND consumed_at IS NOT NULL
    `, [since]),

    scalar(env, `
      SELECT COUNT(*) AS v
      FROM otp_requests
      WHERE created_at >= ?
        AND consumed_at IS NULL
        AND expires_at < ?
    `, [since, now]),

    scalar(env, `
      SELECT COUNT(*) AS v
      FROM alert_rules
    `),

    scalar(env, `
      SELECT COUNT(*) AS v
      FROM alert_rules
      WHERE enabled = 1
    `),

    scalar(env, `
      SELECT COUNT(*) AS v
      FROM alert_state
      WHERE last_fired_at IS NOT NULL
        AND last_fired_at >= ?
    `, [since])
  ]);

  return json(200, "ok", {
    source: "security_metrics_v1",
    days,
    rate_limited,
    lockouts,
    otp_verify_fail,
    password_fail,
    session_anomaly,
    incidents_created,
    active_sessions,
    otp_requests_total,
    otp_consumed,
    otp_expired,
    rules_total,
    rules_enabled,
    rules_fired
  });
}

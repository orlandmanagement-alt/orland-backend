import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

function clampInt(n, a, b){
  n = Number(n);
  if (!Number.isFinite(n)) n = a;
  return Math.max(a, Math.min(b, Math.floor(n)));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;

  if (!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const url = new URL(request.url);
  const days = clampInt(url.searchParams.get("days") || 7, 1, 90);
  const now = nowSec();
  const start = now - (days * 86400);

  // series from daily_metrics if exists (fallback empty)
  let series = [];
  try{
    const r = await env.DB.prepare(`
      SELECT day,
             COALESCE(rate_limited,0) AS rate_limited,
             COALESCE(lockouts,0) AS lockouts,
             COALESCE(otp_verify_fail,0) AS otp_verify_fail,
             COALESCE(password_fail,0) AS password_fail,
             COALESCE(session_anomaly,0) AS session_anomaly
      FROM daily_metrics
      WHERE day >= date(?, 'unixepoch')
      ORDER BY day ASC
    `).bind(start).all();
    series = r.results || [];
  }catch{
    series = [];
  }

  // locked accounts (best effort; if columns not present -> 0)
  let locked_accounts = 0;
  try{
    const r = await env.DB.prepare(`SELECT COUNT(*) AS c FROM users WHERE COALESCE(locked_until,0) > ?`).bind(now).first();
    locked_accounts = Number(r?.c || 0);
  }catch{
    locked_accounts = 0;
  }

  // active ip blocks (best effort)
  let active_ip_blocks = 0;
  try{
    const r = await env.DB.prepare(`SELECT COUNT(*) AS c FROM ip_blocks WHERE revoked_at IS NULL AND expires_at > ?`).bind(now).first();
    active_ip_blocks = Number(r?.c || 0);
  }catch{
    active_ip_blocks = 0;
  }

  return json(200, "ok", {
    now,
    days,
    active_ip_blocks,
    locked_accounts,
    series
  });
}

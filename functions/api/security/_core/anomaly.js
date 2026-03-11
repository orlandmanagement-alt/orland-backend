import { json, requireAuth, hasRole, readJson, nowSec } from "../../../_lib.js";

function s(v){
  return String(v || "").trim();
}

function makeId(prefix = "evt"){
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

async function bumpHourlyMetric(env, hourKey, field){
  const sql = `
    INSERT INTO hourly_metrics (hour, ${field}, updated_at)
    VALUES (?, 1, ?)
    ON CONFLICT(hour) DO UPDATE SET
      ${field} = COALESCE(${field}, 0) + 1,
      updated_at = excluded.updated_at
  `;
  const now = nowSec();
  await env.DB.prepare(sql).bind(hourKey, now).run();
}

function hourKeyFromSec(sec){
  const d = new Date(Number(sec || 0) * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:00`;
}

async function getActor(env, request){
  const a = await requireAuth(env, request);
  if(!a.ok) return a;

  if(!hasRole(a.roles, ["super_admin", "admin", "staff"])){
    return { ok: false, res: json(403, "forbidden", null) };
  }

  return a;
}

export async function onRequestPost({ request, env }){
  const a = await getActor(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const kind = s(body.kind || "manual_test");
  const note = s(body.note || "Triggered manually");
  const now = nowSec();
  const hourKey = hourKeyFromSec(now);

  const meta = {
    kind,
    note,
    source: "api/security/anomaly"
  };

  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id,
      actor_user_id,
      action,
      target_type,
      target_id,
      meta_json,
      created_at,
      route,
      http_status,
      duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    makeId("audit"),
    a.user?.id || null,
    "session_anomaly",
    "security",
    null,
    JSON.stringify(meta),
    now,
    "/api/security/anomaly",
    200,
    0
  ).run();

  await bumpHourlyMetric(env, hourKey, "session_anomaly");

  return json(200, "ok", {
    recorded: true,
    action: "session_anomaly",
    kind,
    note
  });
}

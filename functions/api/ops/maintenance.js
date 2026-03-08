import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

/**
 * GET  /api/ops/maintenance -> health snapshot
 * POST /api/ops/maintenance { action: "purge_audit"|"purge_sessions"|"purge_ip_activity", days: 7 }
 * Notes: aman, soft maintenance (tidak DROP table).
 */

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin"]); } // destructive actions -> super_admin only

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const now = nowSec();

  const users = await env.DB.prepare(`SELECT COUNT(*) AS c FROM users`).first();
  const sessions = await env.DB.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE revoked_at IS NULL AND expires_at > ?`).bind(now).first();
  const audit = await env.DB.prepare(`SELECT COUNT(*) AS c FROM audit_logs`).first();
  const incidents = await env.DB.prepare(`SELECT COUNT(*) AS c FROM incidents WHERE status IN ('open','ack')`).first();
  const ipBlocks = await env.DB.prepare(`SELECT COUNT(*) AS c FROM ip_blocks WHERE revoked_at IS NULL AND expires_at > ?`).bind(now).first();

  return json(200,"ok",{
    now,
    users: Number(users?.c||0),
    sessions_active: Number(sessions?.c||0),
    audit_rows: Number(audit?.c||0),
    incidents_open: Number(incidents?.c||0),
    ip_blocks_active: Number(ipBlocks?.c||0),
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",{message:"super_admin_only"});

  const body = await readJson(request) || {};
  const action = String(body.action||"").trim();
  const days = Math.min(365, Math.max(1, Number(body.days||"30")));
  const cutoff = nowSec() - (days*86400);

  if(action === "purge_audit"){
    const r = await env.DB.prepare(`DELETE FROM audit_logs WHERE created_at < ?`).bind(cutoff).run();
    await audit(env,{ actor_user_id:a.uid, action:"maintenance.purge_audit", route:"POST /api/ops/maintenance", http_status:200, meta:{ days } });
    return json(200,"ok",{ deleted: r?.meta?.changes||0 });
  }

  if(action === "purge_sessions"){
    const r = await env.DB.prepare(`DELETE FROM sessions WHERE (revoked_at IS NOT NULL) OR (expires_at < ?)`).bind(nowSec()).run();
    await audit(env,{ actor_user_id:a.uid, action:"maintenance.purge_sessions", route:"POST /api/ops/maintenance", http_status:200, meta:{} });
    return json(200,"ok",{ deleted: r?.meta?.changes||0 });
  }

  if(action === "purge_ip_activity"){
    const r = await env.DB.prepare(`DELETE FROM ip_activity WHERE window_start < ?`).bind(cutoff).run();
    await audit(env,{ actor_user_id:a.uid, action:"maintenance.purge_ip_activity", route:"POST /api/ops/maintenance", http_status:200, meta:{ days } });
    return json(200,"ok",{ deleted: r?.meta?.changes||0 });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}

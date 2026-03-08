import { json, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function allowedWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

function toInt(v, d=null){
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : d;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q")||"").trim().toLowerCase();
  const status = String(url.searchParams.get("status")||"").trim(); // active|disabled|...
  const limit = Math.min(200, Math.max(1, toInt(url.searchParams.get("limit"), 50)));
  const offset = Math.max(0, toInt(url.searchParams.get("offset"), 0));

  const where = [];
  const bind = [];

  // only client users by role
  where.push(`EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=u.id AND r.name='client'
  )`);

  if(q){
    where.push(`(u.email_norm LIKE ? OR u.display_name LIKE ?)`);
    bind.push(`%${q}%`,`%${q}%`);
  }
  if(status){
    where.push(`u.status = ?`);
    bind.push(status);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const rows = await env.DB.prepare(`
    SELECT
      u.id,u.email_norm,u.display_name,u.status,
      u.created_at,u.updated_at,
      (SELECT MAX(created_at) FROM sessions s WHERE s.user_id=u.id) AS last_login_at
    FROM users u
    ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...bind, limit, offset).all();

  const c = await env.DB.prepare(`
    SELECT COUNT(*) AS n
    FROM users u
    ${whereSql}
  `).bind(...bind).first();

  return json(200,"ok",{ total:Number(c?.n||0), limit, offset, rows:(rows.results||[]) });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowedWrite(a)) return json(403,"forbidden",null);

  // NOTE: client create endpoint can be added later (invite-only recommended).
  // For now keep minimal to avoid schema drift.
  return json(400,"invalid_input",{ message:"client_create_not_enabled_yet" });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowedWrite(a)) return json(403,"forbidden",null);

  const body = await request.json().catch(()=>null) || {};
  const action = String(body.action||"");
  const user_id = String(body.user_id||"");
  if(!user_id) return json(400,"invalid_input",null);

  const now = nowSec();

  if(action==="disable" || action==="enable"){
    const st = action==="disable" ? "disabled" : "active";
    await env.DB.prepare("UPDATE users SET status=?, updated_at=? WHERE id=?")
      .bind(st, now, user_id).run();
    return json(200,"ok",{ updated:true });
  }

  if(action==="revoke_sessions"){
    await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL")
      .bind(now, user_id).run();
    return json(200,"ok",{ revoked:true });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

import { json, requireAuth, hasRole, nowSec } from "../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const now = nowSec();
  const since = now - 15*60; // online = last_seen_at within 15 minutes

  // totals by role (simple via user_roles)
  const roles = await env.DB.prepare(`
    SELECT r.name AS role, COUNT(*) AS cnt
    FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    GROUP BY r.name
  `).all();

  const roleCnt = {};
  for(const x of (roles.results||[])) roleCnt[x.role]=Number(x.cnt||0);

  // online sessions by role snapshot (roles_json)
  const s = await env.DB.prepare(`
    SELECT roles_json FROM sessions
    WHERE revoked_at IS NULL AND expires_at > ? AND last_seen_at >= ?
  `).bind(now, since).all();

  let online_admin=0, online_client=0, online_talent=0, online_total=0;
  for(const row of (s.results||[])){
    let rr=[];
    try{ rr = JSON.parse(row.roles_json||"[]")||[]; }catch{ rr=[]; }
    const set = new Set(rr.map(String));
    if(set.size) online_total++;
    if(set.has("super_admin") || set.has("admin") || set.has("staff")) online_admin++;
    if(set.has("client")) online_client++;
    if(set.has("talent")) online_talent++;
  }

  // projects
  let total_projects = 0;
  try{
    const p = await env.DB.prepare(`SELECT COUNT(*) AS c FROM projects`).first();
    total_projects = Number(p?.c||0);
  }catch{}

  return json(200,"ok",{
    total_admin: (roleCnt.super_admin||0) + (roleCnt.admin||0) + (roleCnt.staff||0),
    total_client: roleCnt.client||0,
    total_talent: roleCnt.talent||0,
    total_projects,
    online_total,
    online_admin,
    online_client,
    online_talent
  });
}

import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function allowRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function allowWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }
function toInt(v,d){ const n=Number(v); return Number.isFinite(n) ? Math.trunc(n) : d; }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowRead(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const group_id = String(url.searchParams.get("group_id")||"").trim();
  if(!group_id) return json(400,"invalid_input",{ message:"group_id_required" });

  const r = await env.DB.prepare(`
    SELECT m.id,m.group_id,m.user_id,m.sort_order,m.active,m.created_at,
           u.email_norm,u.display_name,u.status
    FROM oncall_members m
    LEFT JOIN users u ON u.id=m.user_id
    WHERE m.group_id=?
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).bind(group_id).all();

  return json(200,"ok",{ rows: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const group_id = String(body.group_id||"").trim();
  const user_id = String(body.user_id||"").trim();
  const sort_order = Math.max(0, toInt(body.sort_order, 0));
  const active = body.active == null ? 1 : (body.active ? 1 : 0);
  if(!group_id || !user_id) return json(400,"invalid_input",{ message:"group_id/user_id_required" });

  const now = nowSec();
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO oncall_members (id,group_id,user_id,sort_order,active,created_at)
    VALUES (?,?,?,?,?,?)
  `).bind(id,group_id,user_id,sort_order,active,now).run();

  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  const sets = [];
  const bind = [];
  if(body.sort_order != null){ sets.push("sort_order=?"); bind.push(Math.max(0,toInt(body.sort_order,0))); }
  if(body.active != null){ sets.push("active=?"); bind.push(body.active ? 1 : 0); }

  if(!sets.length) return json(200,"ok",{ updated:true });

  bind.push(id);
  await env.DB.prepare(`UPDATE oncall_members SET ${sets.join(", ")} WHERE id=?`).bind(...bind).run();
  return json(200,"ok",{ updated:true });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  await env.DB.prepare("DELETE FROM oncall_members WHERE id=?").bind(id).run();
  return json(200,"ok",{ deleted:true });
}

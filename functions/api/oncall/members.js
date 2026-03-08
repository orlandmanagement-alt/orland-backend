import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const group_id = String(url.searchParams.get("group_id")||"").trim();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"100")));

  if(!group_id) return json(400,"invalid_input",{message:"group_id_required"});

  const r = await env.DB.prepare(`
    SELECT m.id,m.group_id,m.user_id,m.sort_order,m.active,m.created_at,
           u.email_norm,u.display_name,u.status
    FROM oncall_members m
    LEFT JOIN users u ON u.id=m.user_id
    WHERE m.group_id=?
    ORDER BY m.sort_order ASC, m.created_at ASC
    LIMIT ?
  `).bind(group_id, limit).all();

  return json(200,"ok",{ members: r.results||[] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const group_id = String(body.group_id||"").trim();
  const user_id = String(body.user_id||"").trim();
  const sort_order = Math.max(0, Number(body.sort_order||0));
  const active = body.active == null ? 1 : (body.active ? 1 : 0);

  if(!group_id || !user_id) return json(400,"invalid_input",{message:"group_id/user_id_required"});

  const now = nowSec();
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO oncall_members (id,group_id,user_id,sort_order,active,created_at)
    VALUES (?,?,?,?,?,?)
  `).bind(id,group_id,user_id,sort_order,active,now).run();

  await audit(env,{ actor_user_id:a.uid, action:"oncall_members.create", route:"POST /api/oncall/members", http_status:200, meta:{ id, group_id, user_id } });
  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  const row = await env.DB.prepare(`SELECT id,sort_order,active FROM oncall_members WHERE id=? LIMIT 1`).bind(id).first();
  if(!row) return json(404,"not_found",null);

  const sort_order = body.sort_order != null ? Math.max(0, Number(body.sort_order||0)) : row.sort_order;
  const active = body.active != null ? (body.active ? 1 : 0) : row.active;

  await env.DB.prepare(`
    UPDATE oncall_members
    SET sort_order=?, active=?
    WHERE id=?
  `).bind(sort_order, active, id).run();

  await audit(env,{ actor_user_id:a.uid, action:"oncall_members.update", route:"PUT /api/oncall/members", http_status:200, meta:{ id } });
  return json(200,"ok",{ updated:true });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  await env.DB.prepare(`DELETE FROM oncall_members WHERE id=?`).bind(id).run();
  await audit(env,{ actor_user_id:a.uid, action:"oncall_members.delete", route:"DELETE /api/oncall/members", http_status:200, meta:{ id } });
  return json(200,"ok",{ deleted:true });
}

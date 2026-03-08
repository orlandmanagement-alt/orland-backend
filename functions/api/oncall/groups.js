import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,name,rotation,timezone,week_start,created_at,updated_at
    FROM oncall_groups
    ORDER BY created_at DESC
    LIMIT 200
  `).all();

  return json(200,"ok",{ groups: r.results||[] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const name = String(body.name||"").trim();
  const rotation = String(body.rotation||"weekly").trim().toLowerCase();
  const timezone = String(body.timezone||"UTC").trim();
  const week_start = String(body.week_start||"monday").trim().toLowerCase();

  if(!name) return json(400,"invalid_input",{message:"name_required"});

  const now = nowSec();
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO oncall_groups (id,name,rotation,timezone,created_at,updated_at,week_start)
    VALUES (?,?,?,?,?,?,?)
  `).bind(id,name,rotation,timezone,now,now,week_start).run();

  await audit(env,{ actor_user_id:a.uid, action:"oncall_groups.create", route:"POST /api/oncall/groups", http_status:200, meta:{ id, name } });
  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  const row = await env.DB.prepare(`SELECT id,name,rotation,timezone,week_start FROM oncall_groups WHERE id=? LIMIT 1`).bind(id).first();
  if(!row) return json(404,"not_found",null);

  const name = body.name != null ? String(body.name).trim() : row.name;
  const rotation = body.rotation != null ? String(body.rotation).trim().toLowerCase() : row.rotation;
  const timezone = body.timezone != null ? String(body.timezone).trim() : row.timezone;
  const week_start = body.week_start != null ? String(body.week_start).trim().toLowerCase() : row.week_start;

  const now = nowSec();
  await env.DB.prepare(`
    UPDATE oncall_groups
    SET name=?, rotation=?, timezone=?, week_start=?, updated_at=?
    WHERE id=?
  `).bind(name,rotation,timezone,week_start,now,id).run();

  await audit(env,{ actor_user_id:a.uid, action:"oncall_groups.update", route:"PUT /api/oncall/groups", http_status:200, meta:{ id } });
  return json(200,"ok",{ updated:true });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",{message:"super_admin_only"});

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  await env.DB.prepare(`DELETE FROM oncall_groups WHERE id=?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM oncall_members WHERE group_id=?`).bind(id).run();

  await audit(env,{ actor_user_id:a.uid, action:"oncall_groups.delete", route:"DELETE /api/oncall/groups", http_status:200, meta:{ id } });
  return json(200,"ok",{ deleted:true });
}

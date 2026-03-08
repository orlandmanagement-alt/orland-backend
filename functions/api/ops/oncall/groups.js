import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function allowRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function allowWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }
function clampStr(s,n){ s=String(s||"").trim(); return s.length>n ? s.slice(0,n) : s; }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowRead(a)) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,name,rotation,timezone,week_start,created_at,updated_at
    FROM oncall_groups
    ORDER BY created_at DESC
    LIMIT 200
  `).all();

  return json(200,"ok",{ rows: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const now = nowSec();
  const id = crypto.randomUUID();

  const name = clampStr(body.name, 80);
  const rotation = clampStr(body.rotation, 20) || "weekly";
  const timezone = clampStr(body.timezone, 40) || "UTC";
  const week_start = clampStr(body.week_start, 12) || "monday";

  if(!name) return json(400,"invalid_input",{ message:"name_required" });

  await env.DB.prepare(`
    INSERT INTO oncall_groups (id,name,rotation,timezone,created_at,updated_at,week_start)
    VALUES (?,?,?,?,?,?,?)
  `).bind(id,name,rotation,timezone,now,now,week_start).run();

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
  if(body.name!=null){ sets.push("name=?"); bind.push(clampStr(body.name,80)); }
  if(body.rotation!=null){ sets.push("rotation=?"); bind.push(clampStr(body.rotation,20)); }
  if(body.timezone!=null){ sets.push("timezone=?"); bind.push(clampStr(body.timezone,40)); }
  if(body.week_start!=null){ sets.push("week_start=?"); bind.push(clampStr(body.week_start,12)); }

  sets.push("updated_at=?"); bind.push(nowSec());
  bind.push(id);

  await env.DB.prepare(`UPDATE oncall_groups SET ${sets.join(", ")} WHERE id=?`).bind(...bind).run();
  return json(200,"ok",{ updated:true });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  await env.DB.prepare("DELETE FROM oncall_members WHERE group_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM oncall_groups WHERE id=?").bind(id).run();
  return json(200,"ok",{ deleted:true });
}

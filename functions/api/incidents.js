import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||50)));

  const r = await env.DB.prepare(`
    SELECT id,severity,type,status,summary,created_at,updated_at
    FROM incidents
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  return json(200,"ok",{ incidents: r.results||[] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const b = await readJson(request) || {};
  const severity = String(b.severity||"low").trim();
  const type = String(b.type||"general").trim();
  const summary = String(b.summary||"").trim();
  if(!summary) return json(400,"invalid_input",{message:"summary_required"});

  const now = nowSec();
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO incidents (id,severity,type,status,summary,details_json,created_at,updated_at,owner_user_id)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(id,severity,type,"open",summary,JSON.stringify(b.details||{}),now,now,a.uid).run();

  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const b = await readJson(request) || {};
  const id = String(b.id||"").trim();
  const action = String(b.action||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  const now = nowSec();

  if(action==="ack"){
    await env.DB.prepare(`UPDATE incidents SET status='ack', acknowledged_by_user_id=?, updated_at=? WHERE id=?`)
      .bind(a.uid, now, id).run();
    return json(200,"ok",{ updated:true });
  }

  if(action==="close"){
    await env.DB.prepare(`UPDATE incidents SET status='closed', closed_by_user_id=?, updated_at=? WHERE id=?`)
      .bind(a.uid, now, id).run();
    return json(200,"ok",{ updated:true });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}

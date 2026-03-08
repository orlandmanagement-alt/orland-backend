import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q")||"").trim().toLowerCase();
  const status = (url.searchParams.get("status")||"").trim().toLowerCase(); // open|ack|closed
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));

  const like = q ? `%${q}%` : null;
  const st = status ? status : null;

  const r = await env.DB.prepare(`
    SELECT id,severity,type,status,summary,details_json,created_at,updated_at,
           owner_user_id,acknowledged_by_user_id,closed_by_user_id
    FROM incidents
    WHERE ( ? IS NULL OR summary LIKE ? OR type LIKE ? )
      AND ( ? IS NULL OR status = ? )
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(like, like, like, st, st, limit).all();

  return json(200,"ok",{ rows: r.results||[] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const severity = String(body.severity||"medium").trim().toLowerCase(); // low|medium|high|critical
  const type = String(body.type||"general").trim();
  const summary = String(body.summary||"").trim();
  const details = body.details_json ?? body.details ?? null;

  if(!summary) return json(400,"invalid_input",{message:"summary_required"});

  const now = nowSec();
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO incidents (id,severity,type,status,summary,details_json,created_at,updated_at,owner_user_id)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    ["low","medium","high","critical"].includes(severity)?severity:"medium",
    type,
    "open",
    summary,
    details ? JSON.stringify(details) : null,
    now, now,
    a.uid
  ).run();

  await audit(env,{ actor_user_id:a.uid, action:"incidents.create", route:"POST /api/incidents", http_status:200, meta:{ id, severity, type } });

  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  const action = String(body.action||"").trim(); // ack|close|reopen|update
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  const now = nowSec();

  if(action === "ack"){
    await env.DB.prepare(`
      UPDATE incidents
      SET status='ack', acknowledged_by_user_id=?, updated_at=?
      WHERE id=?
    `).bind(a.uid, now, id).run();
    await audit(env,{ actor_user_id:a.uid, action:"incidents.ack", route:"PUT /api/incidents", http_status:200, meta:{ id } });
    return json(200,"ok",{ updated:true });
  }

  if(action === "close"){
    await env.DB.prepare(`
      UPDATE incidents
      SET status='closed', closed_by_user_id=?, updated_at=?
      WHERE id=?
    `).bind(a.uid, now, id).run();
    await audit(env,{ actor_user_id:a.uid, action:"incidents.close", route:"PUT /api/incidents", http_status:200, meta:{ id } });
    return json(200,"ok",{ updated:true });
  }

  if(action === "reopen"){
    await env.DB.prepare(`
      UPDATE incidents
      SET status='open', closed_by_user_id=NULL, updated_at=?
      WHERE id=?
    `).bind(now, id).run();
    await audit(env,{ actor_user_id:a.uid, action:"incidents.reopen", route:"PUT /api/incidents", http_status:200, meta:{ id } });
    return json(200,"ok",{ updated:true });
  }

  if(action === "update"){
    const severity = body.severity != null ? String(body.severity).trim().toLowerCase() : null;
    const type = body.type != null ? String(body.type).trim() : null;
    const summary = body.summary != null ? String(body.summary).trim() : null;
    const details = (body.details_json ?? body.details) != null ? (body.details_json ?? body.details) : undefined;

    // minimal patch update
    const row = await env.DB.prepare(`SELECT id FROM incidents WHERE id=? LIMIT 1`).bind(id).first();
    if(!row) return json(404,"not_found",null);

    const cur = await env.DB.prepare(`SELECT severity,type,summary,details_json FROM incidents WHERE id=?`).bind(id).first();

    const nextSeverity = severity && ["low","medium","high","critical"].includes(severity) ? severity : cur.severity;
    const nextType = type ?? cur.type;
    const nextSummary = summary ?? cur.summary;
    const nextDetails = details === undefined ? cur.details_json : JSON.stringify(details);

    await env.DB.prepare(`
      UPDATE incidents
      SET severity=?, type=?, summary=?, details_json=?, updated_at=?
      WHERE id=?
    `).bind(nextSeverity, nextType, nextSummary, nextDetails, now, id).run();

    await audit(env,{ actor_user_id:a.uid, action:"incidents.update", route:"PUT /api/incidents", http_status:200, meta:{ id } });
    return json(200,"ok",{ updated:true });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",{message:"super_admin_only"});

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  await env.DB.prepare(`DELETE FROM incidents WHERE id=?`).bind(id).run();
  await audit(env,{ actor_user_id:a.uid, action:"incidents.delete", route:"DELETE /api/incidents", http_status:200, meta:{ id } });
  return json(200,"ok",{ deleted:true });
}

import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

function allow(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

function clamp(n, lo, hi){
  n = Number(n || 0);
  if (Number.isNaN(n)) n = lo;
  return Math.max(lo, Math.min(hi, n));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "").trim();
  const severity = String(url.searchParams.get("severity") || "").trim();
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = clamp(url.searchParams.get("limit") || 50, 1, 200);

  const w = [];
  const bind = [];

  if(status){
    w.push("i.status=?");
    bind.push(status);
  }
  if(severity){
    w.push("i.severity=?");
    bind.push(severity);
  }
  if(q){
    w.push("(i.summary LIKE ? OR i.type LIKE ?)");
    bind.push(`%${q}%`, `%${q}%`);
  }

  const where = w.length ? ("WHERE " + w.join(" AND ")) : "";

  const r = await env.DB.prepare(`
    SELECT
      i.id,i.severity,i.type,i.status,i.summary,i.details_json,
      i.created_at,i.updated_at,
      i.owner_user_id,i.acknowledged_by_user_id,i.closed_by_user_id,
      (SELECT COUNT(*) FROM incident_comments c WHERE c.incident_id=i.id) AS comment_count,
      (SELECT MAX(created_at) FROM incident_comments c WHERE c.incident_id=i.id) AS last_comment_at
    FROM incidents i
    ${where}
    ORDER BY i.updated_at DESC, i.created_at DESC
    LIMIT ?
  `).bind(...bind, limit).all();

  return json(200,"ok",{ rows: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const severity = String(body.severity || "medium").trim(); // low|medium|high|critical
  const type = String(body.type || "general").trim();
  const summary = String(body.summary || "").trim();
  const details_json = body.details_json != null ? JSON.stringify(body.details_json) : null;

  if(!summary || summary.length < 4) return json(400,"invalid_input",{message:"summary"});
  if(!["low","medium","high","critical"].includes(severity)) return json(400,"invalid_input",{message:"severity"});

  const id = crypto.randomUUID();
  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO incidents (id,severity,type,status,summary,details_json,created_at,updated_at,owner_user_id,acknowledged_by_user_id,closed_by_user_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(id, severity, type, "open", summary, details_json, now, now, null, null, null).run();

  await audit(env, { actor_user_id: a.uid, action:"incidents.create", route:"POST /api/ops/incidents", http_status:200, meta:{ id, severity, type } });

  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id || "").trim();
  const action = String(body.action || "").trim();
  if(!id) return json(400,"invalid_input",{message:"id"});

  const now = nowSec();

  // Allowed actions:
  // - ack
  // - close
  // - reopen
  // - assign (owner_user_id)
  // - update (severity/type/summary/details_json)
  if(action === "ack"){
    await env.DB.prepare(`
      UPDATE incidents
      SET status='ack', acknowledged_by_user_id=?, updated_at=?
      WHERE id=? AND status!='closed'
    `).bind(a.uid, now, id).run();
    await audit(env, { actor_user_id: a.uid, action:"incidents.ack", route:"PUT /api/ops/incidents", http_status:200, meta:{ id } });
    return json(200,"ok",{ updated:true });
  }

  if(action === "close"){
    await env.DB.prepare(`
      UPDATE incidents
      SET status='closed', closed_by_user_id=?, updated_at=?
      WHERE id=?
    `).bind(a.uid, now, id).run();
    await audit(env, { actor_user_id: a.uid, action:"incidents.close", route:"PUT /api/ops/incidents", http_status:200, meta:{ id } });
    return json(200,"ok",{ updated:true });
  }

  if(action === "reopen"){
    await env.DB.prepare(`
      UPDATE incidents
      SET status='open', closed_by_user_id=NULL, updated_at=?
      WHERE id=?
    `).bind(now, id).run();
    await audit(env, { actor_user_id: a.uid, action:"incidents.reopen", route:"PUT /api/ops/incidents", http_status:200, meta:{ id } });
    return json(200,"ok",{ updated:true });
  }

  if(action === "assign"){
    const owner_user_id = String(body.owner_user_id || "").trim() || null;
    await env.DB.prepare(`UPDATE incidents SET owner_user_id=?, updated_at=? WHERE id=?`).bind(owner_user_id, now, id).run();
    await audit(env, { actor_user_id: a.uid, action:"incidents.assign", route:"PUT /api/ops/incidents", http_status:200, meta:{ id, owner_user_id } });
    return json(200,"ok",{ updated:true });
  }

  if(action === "update"){
    const severity = body.severity != null ? String(body.severity).trim() : null;
    const type = body.type != null ? String(body.type).trim() : null;
    const summary = body.summary != null ? String(body.summary).trim() : null;
    const details_json = body.details_json != null ? JSON.stringify(body.details_json) : null;

    if(severity && !["low","medium","high","critical"].includes(severity)) return json(400,"invalid_input",{message:"severity"});

    await env.DB.prepare(`
      UPDATE incidents
      SET severity=COALESCE(?,severity),
          type=COALESCE(?,type),
          summary=COALESCE(?,summary),
          details_json=COALESCE(?,details_json),
          updated_at=?
      WHERE id=?
    `).bind(severity, type, summary, details_json, now, id).run();

    await audit(env, { actor_user_id: a.uid, action:"incidents.update", route:"PUT /api/ops/incidents", http_status:200, meta:{ id } });
    return json(200,"ok",{ updated:true });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}

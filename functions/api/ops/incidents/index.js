import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../../_lib.js";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

function clamp(n, lo, hi){
  n = Number(n || 0);
  if(Number.isNaN(n)) n = lo;
  return Math.max(lo, Math.min(hi, n));
}

function normSeverity(s){
  s = String(s||"").toLowerCase().trim();
  const ok = new Set(["low","medium","high","critical"]);
  return ok.has(s) ? s : "medium";
}
function normStatus(s){
  s = String(s||"").toLowerCase().trim();
  const ok = new Set(["open","ack","closed"]);
  return ok.has(s) ? s : "open";
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const limit = clamp(url.searchParams.get("limit") || 80, 1, 200);
  const q = String(url.searchParams.get("q")||"").trim();
  const status = String(url.searchParams.get("status")||"").trim().toLowerCase();
  const severity = String(url.searchParams.get("severity")||"").trim().toLowerCase();

  const where = [];
  const bind = [];

  if(q){
    where.push("(summary LIKE ? OR type LIKE ? OR id LIKE ?)");
    bind.push(`%${q}%`,`%${q}%`,`%${q}%`);
  }
  if(status){
    where.push("status=?");
    bind.push(status);
  }
  if(severity){
    where.push("severity=?");
    bind.push(severity);
  }

  const sql = `
    SELECT id,severity,type,summary,status,owner_user_id,details_json,created_at,updated_at
    FROM incidents
    ${where.length ? "WHERE "+where.join(" AND ") : ""}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `;

  const rows = await env.DB.prepare(sql).bind(...bind, limit).all();

  return json(200,"ok",{ rows: rows.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action || "create").trim();

  // CREATE INCIDENT
  if(action === "create"){
    const now = nowSec();
    const id = crypto.randomUUID();
    const severity = normSeverity(body.severity);
    const type = String(body.type || "general").trim().slice(0,80);
    const summary = String(body.summary || "").trim().slice(0,200);
    const details_json = body.details ? JSON.stringify(body.details) : (body.details_json ? String(body.details_json) : null);

    if(!summary) return json(400,"invalid_input",{ message:"summary_required" });

    await env.DB.prepare(`
      INSERT INTO incidents (id,severity,type,status,summary,details_json,created_at,updated_at,owner_user_id,acknowledged_by_user_id,closed_by_user_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(id,severity,type,"open",summary,details_json,now,now,null,null,null).run();

    await audit(env,{ actor_user_id:a.uid, action:"incident.create", route:"POST /api/ops/incidents", http_status:200, meta:{id,severity,type} });
    return json(200,"ok",{ created:true, id });
  }

  // COMMENT
  if(action === "comment"){
    const incident_id = String(body.incident_id||"").trim();
    const text = String(body.body||"").trim();
    if(!incident_id || !text) return json(400,"invalid_input",{ message:"incident_id/body_required" });

    const now = nowSec();
    const id = crypto.randomUUID();
    const body_hash = (await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))
      .then(b=>btoa(String.fromCharCode(...new Uint8Array(b))));

    await env.DB.prepare(`
      INSERT INTO incident_comments (id,incident_id,author_user_id,body,body_hash,created_at)
      VALUES (?,?,?,?,?,?)
    `).bind(id,incident_id,a.uid,text,await body_hash,now).run();

    await env.DB.prepare(`UPDATE incidents SET updated_at=? WHERE id=?`).bind(now,incident_id).run();

    await audit(env,{ actor_user_id:a.uid, action:"incident.comment", route:"POST /api/ops/incidents", http_status:200, meta:{incident_id} });
    return json(200,"ok",{ created:true, id });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action||"").trim();
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  const now = nowSec();

  // ACK
  if(action === "ack"){
    await env.DB.prepare(`
      UPDATE incidents
      SET status='ack', acknowledged_by_user_id=?, updated_at=?
      WHERE id=?
    `).bind(a.uid, now, id).run();

    await audit(env,{ actor_user_id:a.uid, action:"incident.ack", route:"PUT /api/ops/incidents", http_status:200, meta:{id} });
    return json(200,"ok",{ updated:true });
  }

  // CLOSE
  if(action === "close"){
    await env.DB.prepare(`
      UPDATE incidents
      SET status='closed', closed_by_user_id=?, updated_at=?
      WHERE id=?
    `).bind(a.uid, now, id).run();

    await audit(env,{ actor_user_id:a.uid, action:"incident.close", route:"PUT /api/ops/incidents", http_status:200, meta:{id} });
    return json(200,"ok",{ updated:true });
  }

  // REOPEN
  if(action === "reopen"){
    await env.DB.prepare(`
      UPDATE incidents
      SET status='open', updated_at=?
      WHERE id=?
    `).bind(now, id).run();

    await audit(env,{ actor_user_id:a.uid, action:"incident.reopen", route:"PUT /api/ops/incidents", http_status:200, meta:{id} });
    return json(200,"ok",{ updated:true });
  }

  // EDIT (severity/type/summary)
  if(action === "edit"){
    const severity = body.severity != null ? normSeverity(body.severity) : null;
    const type = body.type != null ? String(body.type||"").trim().slice(0,80) : null;
    const summary = body.summary != null ? String(body.summary||"").trim().slice(0,200) : null;

    const sets = [];
    const bind = [];
    if(severity){ sets.push("severity=?"); bind.push(severity); }
    if(type){ sets.push("type=?"); bind.push(type); }
    if(summary){ sets.push("summary=?"); bind.push(summary); }
    if(!sets.length) return json(400,"invalid_input",{ message:"nothing_to_update" });

    sets.push("updated_at=?"); bind.push(now);
    bind.push(id);

    await env.DB.prepare(`UPDATE incidents SET ${sets.join(", ")} WHERE id=?`).bind(...bind).run();
    await audit(env,{ actor_user_id:a.uid, action:"incident.edit", route:"PUT /api/ops/incidents", http_status:200, meta:{id} });
    return json(200,"ok",{ updated:true });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",{ message:"super_admin_only" });

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  await env.DB.prepare(`DELETE FROM incident_comments WHERE incident_id=?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM incidents WHERE id=?`).bind(id).run();

  await audit(env,{ actor_user_id:a.uid, action:"incident.delete", route:"DELETE /api/ops/incidents", http_status:200, meta:{id} });
  return json(200,"ok",{ deleted:true });
}

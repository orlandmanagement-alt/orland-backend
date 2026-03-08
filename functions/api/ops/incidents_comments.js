import { json, readJson, requireAuth, hasRole, nowSec, sha256Base64, audit } from "../../_lib.js";

function allow(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const incident_id = String(url.searchParams.get("incident_id") || "").trim();
  if(!incident_id) return json(400,"invalid_input",{message:"incident_id"});

  const r = await env.DB.prepare(`
    SELECT id,incident_id,author_user_id,body,created_at
    FROM incident_comments
    WHERE incident_id=?
    ORDER BY created_at DESC
    LIMIT 200
  `).bind(incident_id).all();

  return json(200,"ok",{ rows: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const incident_id = String(body.incident_id || "").trim();
  const text = String(body.body || "").trim();

  if(!incident_id || text.length < 2) return json(400,"invalid_input", { message:"incident_id/body" });

  const id = crypto.randomUUID();
  const now = nowSec();
  const body_hash = await sha256Base64(text);

  await env.DB.prepare(`
    INSERT INTO incident_comments (id,incident_id,author_user_id,body,body_hash,created_at)
    VALUES (?,?,?,?,?,?)
  `).bind(id, incident_id, a.uid, text, body_hash, now).run();

  // bump incident updated_at
  await env.DB.prepare(`UPDATE incidents SET updated_at=? WHERE id=?`).bind(now, incident_id).run();

  await audit(env, { actor_user_id: a.uid, action:"incidents.comment", route:"POST /api/ops/incidents/comments", http_status:200, meta:{ incident_id } });

  return json(200,"ok",{ created:true, id });
}

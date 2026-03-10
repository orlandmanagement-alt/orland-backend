import { json, readJson, requireAuth, hasRole, nowSec, sha256Base64, auditEvent } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const incident_id = String(url.searchParams.get("incident_id") || "").trim();
  if(!incident_id) return json(400, "invalid_input", { message:"incident_id_required" });

  const r = await env.DB.prepare(`
    SELECT
      id, incident_id, author_user_id, body, body_hash, created_at
    FROM incident_comments
    WHERE incident_id=?
    ORDER BY created_at ASC
  `).bind(incident_id).all();

  return json(200, "ok", { items: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const started = Date.now();

  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const incident_id = String(body.incident_id || "").trim();
  const bodyText = String(body.body || "").trim();

  if(!incident_id || !bodyText){
    return json(400, "invalid_input", { message:"incident_id_body_required" });
  }

  const incident = await env.DB.prepare(`
    SELECT id FROM incidents WHERE id=? LIMIT 1
  `).bind(incident_id).first();
  if(!incident) return json(404, "not_found", { message:"incident_not_found" });

  const id = crypto.randomUUID();
  const created_at = nowSec();
  const body_hash = await sha256Base64(bodyText);

  await env.DB.prepare(`
    INSERT INTO incident_comments (
      id, incident_id, author_user_id, body, body_hash, created_at
    )
    VALUES (?,?,?,?,?,?)
  `).bind(
    id,
    incident_id,
    a.uid,
    bodyText,
    body_hash,
    created_at
  ).run();

  await env.DB.prepare(`
    UPDATE incidents
    SET updated_at=?
    WHERE id=?
  `).bind(created_at, incident_id).run();

  // simple @mention parser: @<user_id>
  const mentionMatches = Array.from(bodyText.matchAll(/@([A-Za-z0-9_\-]{6,})/g));
  for(const m of mentionMatches){
    const mentioned_user_id = String(m[1] || "").trim();
    if(!mentioned_user_id) continue;
    await env.DB.prepare(`
      INSERT INTO incident_comment_mentions (
        id, comment_id, incident_id, mentioned_user_id, created_at
      )
      VALUES (?,?,?,?,?)
    `).bind(
      crypto.randomUUID(),
      id,
      incident_id,
      mentioned_user_id,
      created_at
    ).run();
  }

  await auditEvent(env, request, {
    actor_user_id: a.uid,
    action: "incident_comment_add",
    target_type: "incident",
    target_id: incident_id,
    http_status: 200,
    duration_ms: Date.now() - started,
    meta: {
      comment_id: id,
      mentions: mentionMatches.length
    }
  });

  return json(200, "ok", {
    created: true,
    comment: {
      id,
      incident_id,
      author_user_id: a.uid,
      body: bodyText,
      body_hash,
      created_at
    }
  });
}

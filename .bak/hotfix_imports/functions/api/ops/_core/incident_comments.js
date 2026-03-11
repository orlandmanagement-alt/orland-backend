import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function s(v){ return String(v || "").trim(); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const url = new URL(request.url);
  const incident_id = s(url.searchParams.get("incident_id"));
  if(!incident_id) return json(400, "invalid_input", { message:"incident_id_required" });

  const ex = await env.DB.prepare(`SELECT id FROM incidents WHERE id=? LIMIT 1`).bind(incident_id).first();
  if(!ex) return json(404, "not_found", { message:"incident_not_found" });

  const r = await env.DB.prepare(`
    SELECT
      c.id,
      c.incident_id,
      c.author_user_id,
      c.body,
      c.body_hash,
      c.created_at,
      u.display_name AS author_name,
      u.email_norm AS author_email
    FROM incident_comments c
    LEFT JOIN users u ON u.id = c.author_user_id
    WHERE c.incident_id=?
    ORDER BY c.created_at ASC
  `).bind(incident_id).all();

  return json(200, "ok", {
    items: r.results || []
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const incident_id = s(body.incident_id);
  const comment = s(body.body);

  if(!incident_id) return json(400, "invalid_input", { message:"incident_id_required" });
  if(!comment) return json(400, "invalid_input", { message:"body_required" });

  const ex = await env.DB.prepare(`SELECT id FROM incidents WHERE id=? LIMIT 1`).bind(incident_id).first();
  if(!ex) return json(404, "not_found", { message:"incident_not_found" });

  const id = "icom_" + crypto.randomUUID();
  const now = nowSec();
  const body_hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(comment)).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
  );

  await env.DB.prepare(`
    INSERT INTO incident_comments (
      id, incident_id, author_user_id, body, body_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    incident_id,
    a.user?.id || null,
    comment,
    body_hash,
    now
  ).run();

  await env.DB.prepare(`
    UPDATE incidents
    SET updated_at=?
    WHERE id=?
  `).bind(now, incident_id).run();

  return json(200, "ok", {
    saved: true,
    id
  });
}

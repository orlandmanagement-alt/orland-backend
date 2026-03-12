import { json, readJson, nowSec } from "../../../_lib.js";
import { requireBlogspotAccess, makeId, addSyncLog } from "./_service.js";

function s(v){ return String(v || "").trim(); }

async function getLocalRow(env, kind, id){
  if(kind === "post"){
    return await env.DB.prepare(`
      SELECT id, title, slug, external_id
      FROM cms_posts
      WHERE id=?
      LIMIT 1
    `).bind(id).first();
  }

  if(kind === "page"){
    return await env.DB.prepare(`
      SELECT id, title, slug, external_id
      FROM cms_pages
      WHERE id=?
      LIMIT 1
    `).bind(id).first();
  }

  return null;
}

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const kind = s(body.kind).toLowerCase();
  const local_id = s(body.local_id);
  const reason = s(body.reason);

  if(!["post","page"].includes(kind)){
    return json(400, "invalid_input", { error:"invalid_kind" });
  }
  if(!local_id){
    return json(400, "invalid_input", { error:"local_id_required" });
  }
  if(!reason){
    return json(400, "invalid_input", { error:"reason_required" });
  }

  const row = await getLocalRow(env, kind, local_id);
  if(!row){
    return json(404, "not_found", { error:`${kind}_not_found` });
  }

  const remote_id = s(row.external_id);
  if(!remote_id){
    return json(400, "invalid_input", { error:"remote_id_missing" });
  }

  const pending = await env.DB.prepare(`
    SELECT id
    FROM blogspot_remote_delete_requests
    WHERE kind=? AND local_id=? AND status='pending'
    LIMIT 1
  `).bind(kind, local_id).first();

  if(pending){
    return json(400, "invalid_input", {
      error:"pending_request_exists",
      request_id: String(pending.id || "")
    });
  }

  const id = makeId("bsdelreq");
  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO blogspot_remote_delete_requests (
      id, kind, local_id, remote_id, title, slug, reason,
      requested_by, requested_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    kind,
    local_id,
    remote_id,
    row.title || null,
    row.slug || null,
    reason,
    a.uid || null,
    now,
    "pending"
  ).run();

  await addSyncLog(env, {
    direction: "system",
    kind,
    local_id,
    remote_id,
    actor_user_id: a.uid || null,
    action: "remote_delete_request_create",
    status: "ok",
    message: "remote delete request created",
    payload_json: {
      request_id: id,
      reason
    }
  });

  return json(200, "ok", {
    created: true,
    request_id: id,
    kind,
    local_id,
    remote_id
  });
}

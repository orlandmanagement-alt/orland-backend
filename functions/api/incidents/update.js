import { json, readJson, requireAuth, hasRole, nowSec, auditEvent } from "../../_lib.js";

const ALLOWED_STATUS = new Set(["open","acknowledged","closed"]);

export async function onRequestPost({ request, env }){
  const started = Date.now();

  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const incident_id = String(body.incident_id || "").trim();
  const status = String(body.status || "").trim();
  const owner_user_id = body.owner_user_id ? String(body.owner_user_id).trim() : null;

  if(!incident_id) return json(400, "invalid_input", { message:"incident_id_required" });

  const row = await env.DB.prepare(`
    SELECT id, status
    FROM incidents
    WHERE id=?
    LIMIT 1
  `).bind(incident_id).first();

  if(!row) return json(404, "not_found", { message:"incident_not_found" });

  const now = nowSec();

  if(status){
    if(!ALLOWED_STATUS.has(status)){
      return json(400, "invalid_input", { message:"invalid_status" });
    }

    const ackBy = status === "acknowledged" ? a.uid : null;
    const closedBy = status === "closed" ? a.uid : null;

    await env.DB.prepare(`
      UPDATE incidents
      SET
        status=?,
        updated_at=?,
        acknowledged_by_user_id=COALESCE(?, acknowledged_by_user_id),
        closed_by_user_id=COALESCE(?, closed_by_user_id),
        owner_user_id=COALESCE(?, owner_user_id)
      WHERE id=?
    `).bind(
      status,
      now,
      ackBy,
      closedBy,
      owner_user_id,
      incident_id
    ).run();

    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "incident_status_update",
      target_type: "incident",
      target_id: incident_id,
      http_status: 200,
      duration_ms: Date.now() - started,
      meta: {
        from_status: row.status,
        to_status: status,
        owner_user_id
      }
    });

    return json(200, "ok", {
      updated: true,
      incident_id,
      status
    });
  }

  if(owner_user_id){
    await env.DB.prepare(`
      UPDATE incidents
      SET owner_user_id=?, updated_at=?
      WHERE id=?
    `).bind(owner_user_id, now, incident_id).run();

    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "incident_status_update",
      target_type: "incident",
      target_id: incident_id,
      http_status: 200,
      duration_ms: Date.now() - started,
      meta: {
        owner_user_id
      }
    });

    return json(200, "ok", {
      updated: true,
      incident_id,
      owner_user_id
    });
  }

  return json(400, "invalid_input", { message:"nothing_to_update" });
}

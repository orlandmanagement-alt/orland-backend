import { json, readJson, nowSec, hasRole } from "../../../_lib.js";
import { requireBlogspotAccess, addSyncLog } from "./_service.js";

function s(v){ return String(v || "").trim(); }

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const id = s(body.request_id);
  const decision = s(body.decision).toLowerCase();
  const decision_note = s(body.decision_note);

  if(!id){
    return json(400, "invalid_input", { error:"request_id_required" });
  }
  if(!["approved","rejected"].includes(decision)){
    return json(400, "invalid_input", { error:"invalid_decision" });
  }

  const row = await env.DB.prepare(`
    SELECT id, kind, local_id, remote_id, status
    FROM blogspot_remote_delete_requests
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!row){
    return json(404, "not_found", { error:"request_not_found" });
  }

  if(String(row.status || "") !== "pending"){
    return json(400, "invalid_input", { error:"request_not_pending" });
  }

  const now = nowSec();

  await env.DB.prepare(`
    UPDATE blogspot_remote_delete_requests
    SET status=?,
        decided_by=?,
        decided_at=?,
        decision_note=?
    WHERE id=?
  `).bind(
    decision,
    a.uid || null,
    now,
    decision_note || null,
    id
  ).run();

  await addSyncLog(env, {
    direction: "system",
    kind: String(row.kind || ""),
    local_id: row.local_id || null,
    remote_id: row.remote_id || null,
    actor_user_id: a.uid || null,
    action: "remote_delete_request_decide",
    status: "ok",
    message: `remote delete request ${decision}`,
    payload_json: {
      request_id: id,
      decision,
      decision_note
    }
  });

  return json(200, "ok", {
    saved: true,
    request_id: id,
    decision
  });
}

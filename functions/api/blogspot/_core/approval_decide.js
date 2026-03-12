import { json, readJson, nowSec } from "../../../_lib.js";
import { requireBlogspotAccess, hasRole, markMapDirty } from "./_service.js";

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const local_id = String(body.local_id || "").trim();
  const decision = String(body.decision || "").trim().toLowerCase();

  if(!local_id) return json(400, "invalid_input", { error:"local_id_required" });
  if(!["approved","rejected","pending"].includes(decision)){
    return json(400, "invalid_input", { error:"invalid_decision" });
  }

  const row = await env.DB.prepare(`
    SELECT local_id, kind, title, slug, remote_id
    FROM blogspot_post_map
    WHERE local_id=?
    LIMIT 1
  `).bind(local_id).first();

  if(!row) return json(404, "not_found", { error:"map_not_found" });

  const approved_at = decision === "approved" ? nowSec() : null;
  const approved_by = decision === "approved" ? String(a.uid || "") : null;

  await markMapDirty(env, String(row.kind || "post"), local_id, {
    remote_id: row.remote_id || null,
    title: row.title || "",
    slug: row.slug || "",
    approval_status: decision,
    approved_by,
    approved_at,
    dirty: 1,
    deleted_local: 0,
    deleted_remote: 0,
    sync_state: decision === "approved" ? "approved_waiting_push" : "approval_pending",
    last_actor_user_id: a.uid || null,
    action: "approval_decide",
    direction: "system",
    status: "ok",
    message: `approval ${decision}`,
    payload_json: { local_id, decision }
  });

  return json(200, "ok", {
    saved: true,
    local_id,
    decision
  });
}

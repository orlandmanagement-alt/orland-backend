import { json, readJson, requireAuth, nowSec } from "../../_lib.js";

function canAccessTalent(roles){
  const set = new Set((roles || []).map(String));
  return set.has("talent") || set.has("super_admin") || set.has("admin");
}

export async function onRequestPost({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessTalent(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const body = await readJson(request) || {};
  const applicationId = String(body.application_id || "").trim();

  if(!applicationId){
    return json(400, "invalid_input", { message: "application_id_required" });
  }

  const found = await env.DB.prepare(`
    SELECT id, talent_user_id, status
    FROM project_applications
    WHERE id = ?
    LIMIT 1
  `).bind(applicationId).first();

  if(!found){
    return json(404, "not_found", { message: "application_not_found" });
  }

  if(String(found.talent_user_id || "") !== String(auth.uid)){
    return json(403, "forbidden", { message: "application_not_owned_by_user" });
  }

  if(["withdrawn", "accepted", "rejected"].includes(String(found.status || "").toLowerCase())){
    return json(409, "conflict", {
      message: "application_status_not_withdrawable",
      status: found.status || ""
    });
  }

  const updatedAt = nowSec();

  try{
    await env.DB.prepare(`
      UPDATE project_applications
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      "withdrawn",
      updatedAt,
      applicationId
    ).run();

    return json(200, "ok", {
      id: applicationId,
      status: "withdrawn",
      updated_at: updatedAt
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_withdraw_application",
      detail: String(err?.message || err)
    });
  }
}

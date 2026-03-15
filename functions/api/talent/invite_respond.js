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
  const inviteId = String(body.invite_id || "").trim();
  const decision = String(body.decision || "").trim().toLowerCase();
  const message = String(body.message || "").trim();

  if(!inviteId){
    return json(400, "invalid_input", { message: "invite_id_required" });
  }

  if(!["accepted", "declined"].includes(decision)){
    return json(400, "invalid_input", { message: "decision_must_be_accepted_or_declined" });
  }

  const invite = await env.DB.prepare(`
    SELECT
      id,
      project_role_id,
      talent_user_id,
      status
    FROM project_invites
    WHERE id = ?
    LIMIT 1
  `).bind(inviteId).first();

  if(!invite){
    return json(404, "not_found", { message: "invite_not_found" });
  }

  if(String(invite.talent_user_id || "") !== String(auth.uid)){
    return json(403, "forbidden", { message: "invite_not_owned_by_user" });
  }

  if(String(invite.status || "").toLowerCase() !== "pending"){
    return json(409, "conflict", {
      message: "invite_not_pending",
      status: invite.status || ""
    });
  }

  const respondedAt = nowSec();

  try{
    await env.DB.prepare(`
      UPDATE project_invites
      SET status = ?, response_message = ?, responded_at = ?
      WHERE id = ?
    `).bind(
      decision,
      message,
      respondedAt,
      inviteId
    ).run();

    return json(200, "ok", {
      id: inviteId,
      project_role_id: invite.project_role_id,
      talent_user_id: auth.uid,
      status: decision,
      response_message: message,
      responded_at: respondedAt
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_respond_invite",
      detail: String(err?.message || err)
    });
  }
}

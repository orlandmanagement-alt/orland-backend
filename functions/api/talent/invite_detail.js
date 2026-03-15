import { json, requireAuth } from "../../_lib.js";

function canAccessTalent(roles){
  const set = new Set((roles || []).map(String));
  return set.has("talent") || set.has("super_admin") || set.has("admin");
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessTalent(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const url = new URL(request.url);
  const inviteId = String(url.searchParams.get("invite_id") || "").trim();

  if(!inviteId){
    return json(400, "invalid_input", { message: "invite_id_required" });
  }

  try{
    const row = await env.DB.prepare(`
      SELECT
        i.id,
        i.project_role_id,
        i.talent_user_id,
        i.status,
        i.message,
        i.response_message,
        i.created_at,
        i.responded_at,
        pr.title AS role_title,
        p.id AS project_id,
        p.title AS project_title
      FROM project_invites i
      LEFT JOIN project_roles pr ON pr.id = i.project_role_id
      LEFT JOIN projects p ON p.id = pr.project_id
      WHERE i.id = ?
      LIMIT 1
    `).bind(inviteId).first();

    if(!row){
      return json(404, "not_found", { message: "invite_not_found" });
    }

    if(String(row.talent_user_id || "") !== String(auth.uid)){
      return json(403, "forbidden", { message: "invite_not_owned_by_user" });
    }

    return json(200, "ok", {
      id: row.id,
      project_id: row.project_id,
      project_title: row.project_title || "",
      project_role_id: row.project_role_id,
      role_title: row.role_title || "",
      talent_user_id: row.talent_user_id,
      status: row.status || "",
      message: row.message || "",
      response_message: row.response_message || "",
      created_at: row.created_at || null,
      responded_at: row.responded_at || null
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_invite_detail",
      detail: String(err?.message || err)
    });
  }
}

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
  const projectRoleId = String(body.project_role_id || "").trim();
  const message = String(body.message || "").trim();

  if(!projectRoleId){
    return json(400, "invalid_input", { message: "project_role_id_required" });
  }

  const role = await env.DB.prepare(`
    SELECT
      pr.id,
      pr.project_id,
      pr.title,
      p.status AS project_status,
      p.title AS project_title
    FROM project_roles pr
    LEFT JOIN projects p ON p.id = pr.project_id
    WHERE pr.id = ?
    LIMIT 1
  `).bind(projectRoleId).first();

  if(!role){
    return json(404, "not_found", { message: "project_role_not_found" });
  }

  const exists = await env.DB.prepare(`
    SELECT id, status
    FROM project_applications
    WHERE project_role_id = ? AND talent_user_id = ?
    LIMIT 1
  `).bind(projectRoleId, auth.uid).first();

  if(exists){
    return json(409, "conflict", {
      message: "application_already_exists",
      id: exists.id,
      status: exists.status || ""
    });
  }

  const id = crypto.randomUUID();
  const createdAt = nowSec();

  try{
    await env.DB.prepare(`
      INSERT INTO project_applications (
        id, project_role_id, talent_user_id, status, message, created_at
      ) VALUES (?,?,?,?,?,?)
    `).bind(
      id,
      projectRoleId,
      auth.uid,
      "submitted",
      message,
      createdAt
    ).run();

    return json(200, "ok", {
      id,
      project_role_id: projectRoleId,
      talent_user_id: auth.uid,
      project_title: role.project_title || "",
      role_title: role.title || "",
      status: "submitted",
      message,
      created_at: createdAt
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_submit_application",
      detail: String(err?.message || err)
    });
  }
}

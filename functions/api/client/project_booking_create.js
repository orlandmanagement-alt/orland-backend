import { json, readJson, requireAuth, nowSec } from "../../_lib.js";

function canAccessClient(roles){
  const set = new Set((roles || []).map(String));
  return set.has("client") || set.has("super_admin") || set.has("admin");
}

export async function onRequestPost({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessClient(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const body = await readJson(request) || {};
  const projectRoleId = String(body.project_role_id || "").trim();
  const talentUserId = String(body.talent_user_id || "").trim();
  const notes = String(body.notes || "").trim();

  if(!projectRoleId || !talentUserId){
    return json(400, "invalid_input", { message: "project_role_id_and_talent_user_id_required" });
  }

  const role = await env.DB.prepare(`
    SELECT id, project_id, title
    FROM project_roles
    WHERE id = ?
    LIMIT 1
  `).bind(projectRoleId).first();

  if(!role){
    return json(404, "not_found", { message: "project_role_not_found" });
  }

  const talent = await env.DB.prepare(`
    SELECT id, display_name, status
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(talentUserId).first();

  if(!talent){
    return json(404, "not_found", { message: "talent_not_found" });
  }

  const exists = await env.DB.prepare(`
    SELECT id, status
    FROM project_bookings
    WHERE project_role_id = ? AND talent_user_id = ?
    LIMIT 1
  `).bind(projectRoleId, talentUserId).first();

  if(exists){
    return json(409, "conflict", {
      message: "booking_already_exists",
      id: exists.id,
      status: exists.status || ""
    });
  }

  const id = crypto.randomUUID();
  const createdAt = nowSec();

  try{
    await env.DB.prepare(`
      INSERT INTO project_bookings (
        id, project_role_id, talent_user_id, status, notes, created_at
      ) VALUES (?,?,?,?,?,?)
    `).bind(
      id,
      projectRoleId,
      talentUserId,
      "pending",
      notes,
      createdAt
    ).run();

    return json(200, "ok", {
      id,
      project_role_id: projectRoleId,
      talent_user_id: talentUserId,
      status: "pending",
      notes,
      created_at: createdAt
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_create_booking",
      detail: String(err?.message || err)
    });
  }
}

import { json, requireAuth } from "../../_lib.js";

function canAccessProject(roles){
  const set = new Set((roles || []).map(String));
  return (
    set.has("client") ||
    set.has("super_admin") ||
    set.has("admin") ||
    set.has("staff")
  );
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessProject(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const url = new URL(request.url);
  const projectId = String(url.searchParams.get("project_id") || "").trim();

  if(!projectId){
    return json(400, "invalid_input", { message: "project_id_required" });
  }

  try{
    const applications = await env.DB.prepare(`
      SELECT COUNT(*) AS c
      FROM project_applications a
      LEFT JOIN project_roles pr ON pr.id = a.project_role_id
      WHERE pr.project_id = ?
    `).bind(projectId).first();

    const shortlists = await env.DB.prepare(`
      SELECT COUNT(*) AS c
      FROM project_shortlists s
      LEFT JOIN project_roles pr ON pr.id = s.project_role_id
      WHERE pr.project_id = ?
    `).bind(projectId).first();

    const invites = await env.DB.prepare(`
      SELECT COUNT(*) AS c
      FROM project_invites i
      LEFT JOIN project_roles pr ON pr.id = i.project_role_id
      WHERE pr.project_id = ?
    `).bind(projectId).first();

    const bookings = await env.DB.prepare(`
      SELECT COUNT(*) AS c
      FROM project_bookings b
      LEFT JOIN project_roles pr ON pr.id = b.project_role_id
      WHERE pr.project_id = ?
    `).bind(projectId).first();

    return json(200, "ok", {
      project_id: projectId,
      summary: {
        applications: Number(applications?.c || 0),
        shortlists: Number(shortlists?.c || 0),
        invites: Number(invites?.c || 0),
        bookings: Number(bookings?.c || 0)
      }
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_pipeline",
      detail: String(err?.message || err)
    });
  }
}

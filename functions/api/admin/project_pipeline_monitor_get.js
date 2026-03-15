import { json, requireAuth } from "../../_lib.js";

function canAccessAdmin(roles){
  const set = new Set((roles || []).map(String));
  return (
    set.has("super_admin") ||
    set.has("admin") ||
    set.has("staff") ||
    set.has("ops_admin") ||
    set.has("audit_admin")
  );
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessAdmin(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  try{
    const projects = await env.DB.prepare(`
      SELECT id, title, status
      FROM projects
      ORDER BY created_at DESC
      LIMIT 100
    `).all();

    const items = [];
    for(const p of (projects.results || [])){
      const applications = await env.DB.prepare(`
        SELECT COUNT(*) AS c
        FROM project_applications a
        LEFT JOIN project_roles pr ON pr.id = a.project_role_id
        WHERE pr.project_id = ?
      `).bind(p.id).first();

      const shortlists = await env.DB.prepare(`
        SELECT COUNT(*) AS c
        FROM project_shortlists s
        LEFT JOIN project_roles pr ON pr.id = s.project_role_id
        WHERE pr.project_id = ?
      `).bind(p.id).first();

      const invites = await env.DB.prepare(`
        SELECT COUNT(*) AS c
        FROM project_invites i
        LEFT JOIN project_roles pr ON pr.id = i.project_role_id
        WHERE pr.project_id = ?
      `).bind(p.id).first();

      const bookings = await env.DB.prepare(`
        SELECT COUNT(*) AS c
        FROM project_bookings b
        LEFT JOIN project_roles pr ON pr.id = b.project_role_id
        WHERE pr.project_id = ?
      `).bind(p.id).first();

      items.push({
        project_id: p.id,
        project_title: p.title,
        project_status: p.status,
        applications: Number(applications?.c || 0),
        shortlists: Number(shortlists?.c || 0),
        invites: Number(invites?.c || 0),
        bookings: Number(bookings?.c || 0)
      });
    }

    return json(200, "ok", { items });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_project_pipeline_monitor",
      detail: String(err?.message || err)
    });
  }
}

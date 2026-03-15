import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff","client"])) return json(403, "forbidden", null);

  const r = await env.DB.prepare(`
    SELECT
      pr.id,
      pr.project_id,
      pr.role_name,
      pr.role_type,
      pr.status,
      p.title AS project_title
    FROM project_roles pr
    JOIN projects p ON p.id = pr.project_id
    ORDER BY p.created_at DESC, pr.created_at DESC
  `).all();

  return json(200, "ok", { items: r.results || [] });
}

import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const r = await env.DB.prepare(`
    SELECT u.id, u.email_norm, u.display_name, u.status,
           (SELECT MAX(created_at) FROM sessions s WHERE s.user_id=u.id) AS last_login_at
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles ro ON ro.id=ur.role_id
    WHERE ro.name='talent'
    ORDER BY u.created_at DESC
  `).all();

  const items = (r.results || []).map(x => ({
    ...x,
    verification_status: "pending"
  }));

  return json(200, "ok", { items });
}

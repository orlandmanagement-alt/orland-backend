import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const r = await env.DB.prepare(`
    SELECT u.id, u.email_norm, u.display_name, u.status,
           COUNT(s.id) AS total_sessions,
           MAX(s.created_at) AS last_login_at
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles ro ON ro.id=ur.role_id
    LEFT JOIN sessions s ON s.user_id=u.id
    WHERE ro.name='client'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  return json(200, "ok", { items: r.results || [] });
}

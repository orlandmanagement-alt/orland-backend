import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q")||"").trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));
  const like = q ? `%${q}%` : null;

  const r = await env.DB.prepare(`
    SELECT
      u.id,u.email_norm,u.display_name,u.status,u.created_at,u.updated_at,
      MAX(s.created_at) AS last_login_at,
      GROUP_CONCAT(ro.name) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id=u.id
    LEFT JOIN roles ro ON ro.id=ur.role_id
    LEFT JOIN sessions s ON s.user_id=u.id
    WHERE ( ? IS NULL OR u.email_norm LIKE ? OR u.display_name LIKE ? )
    GROUP BY u.id
    HAVING INSTR(','||IFNULL(roles,'')||',', ',client,') > 0
    ORDER BY u.created_at DESC
    LIMIT ?
  `).bind(like, like, like, limit).all();

  const users = (r.results||[]).map(x=>({
    id:x.id,
    email_norm:x.email_norm,
    display_name:x.display_name,
    status:x.status,
    roles: String(x.roles||"").split(",").filter(Boolean),
    last_login_at: x.last_login_at || null,
    created_at:x.created_at,
    updated_at:x.updated_at
  }));

  return json(200,"ok",{ users });
}

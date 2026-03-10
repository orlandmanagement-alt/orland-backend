import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "100")));
  const like = q ? `%${q}%` : null;

  const r = await env.DB.prepare(`
    SELECT
      u.id,
      u.display_name,
      u.email_norm,
      u.status,
      GROUP_CONCAT(ro.name) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles ro ON ro.id = ur.role_id
    WHERE u.status='active'
      AND (
        ? IS NULL OR
        u.display_name LIKE ? OR
        u.email_norm LIKE ?
      )
    GROUP BY u.id
    ORDER BY
      CASE WHEN u.display_name IS NULL OR u.display_name='' THEN 1 ELSE 0 END,
      u.display_name ASC,
      u.email_norm ASC
    LIMIT ?
  `).bind(like, like, like, limit).all();

  const items = (r.results || []).map(x => ({
    id: x.id,
    display_name: x.display_name || "",
    email_norm: x.email_norm || "",
    status: x.status || "",
    roles: String(x.roles || "").split(",").filter(Boolean)
  }));

  return json(200, "ok", { items });
}

import { json, requireAuth, hasRole } from "../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const rolesR = await env.DB.prepare(`
    SELECT id, name
    FROM roles
    ORDER BY name ASC
  `).all();

  const menusR = await env.DB.prepare(`
    SELECT
      m.id,
      m.code,
      m.label,
      m.path,
      m.parent_id,
      m.sort_order,
      m.icon,
      m.created_at,
      COALESCE((
        SELECT json_group_array(name)
        FROM (
          SELECT r.name AS name
          FROM role_menus rm
          JOIN roles r ON r.id = rm.role_id
          WHERE rm.menu_id = m.id
          ORDER BY r.name ASC
        )
      ), '[]') AS role_names_json
    FROM menus m
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).all();

  const menus = (menusR.results || []).map(row => {
    let role_names = [];
    try{
      role_names = JSON.parse(row.role_names_json || "[]");
      if(!Array.isArray(role_names)) role_names = [];
    }catch{
      role_names = [];
    }

    return {
      id: row.id,
      code: row.code || "",
      label: row.label || "",
      path: row.path || "/",
      parent_id: row.parent_id || null,
      sort_order: Number(row.sort_order ?? 50),
      icon: row.icon || "",
      created_at: Number(row.created_at ?? 0),
      role_names
    };
  });

  return json(200, "ok", {
    roles: rolesR.results || [],
    menus
  });
}

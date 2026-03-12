import { json, requireAuth, hasRole } from "../../_lib.js";

function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return [
    "dashboard","access","users","security",
    "content","ops","data","settings","audit"
  ].includes(x) ? x : "settings";
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin", "audit_admin"])){
    return json(403, "forbidden", null);
  }

  const rolesRes = await env.DB.prepare(`
    SELECT id, name, created_at
    FROM roles
    ORDER BY name ASC, created_at ASC
  `).all();

  const menusRes = await env.DB.prepare(`
    SELECT id, code, label, path, group_key, parent_id, sort_order, created_at
    FROM menus
    ORDER BY group_key ASC, sort_order ASC, created_at ASC
  `).all();

  const roleMenusRes = await env.DB.prepare(`
    SELECT role_id, menu_id
    FROM role_menus
  `).all();

  const roles = (rolesRes.results || []).map(x => ({
    id: String(x.id || ""),
    name: String(x.name || ""),
    created_at: Number(x.created_at || 0)
  }));

  const menus = (menusRes.results || []).map(x => ({
    id: String(x.id || ""),
    code: String(x.code || ""),
    label: String(x.label || ""),
    path: String(x.path || ""),
    parent_id: x.parent_id ? String(x.parent_id) : null,
    group_key: normalizeGroupKey(x.group_key),
    sort_order: Number(x.sort_order || 9999),
    created_at: Number(x.created_at || 0)
  }));

  const assignments = (roleMenusRes.results || []).map(x => ({
    role_id: String(x.role_id || ""),
    menu_id: String(x.menu_id || "")
  }));

  const matrix = {};
  for(const role of roles){
    matrix[role.id] = {};
  }
  for(const a of assignments){
    if(!matrix[a.role_id]) matrix[a.role_id] = {};
    matrix[a.role_id][a.menu_id] = true;
  }

  const summary = roles.map(role => ({
    role_id: role.id,
    role_name: role.name,
    menu_count: Object.keys(matrix[role.id] || {}).length
  }));

  return json(200, "ok", {
    roles,
    menus,
    matrix,
    summary
  });
}

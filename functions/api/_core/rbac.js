import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function listRoles(env){
  const r = await env.DB.prepare(`
    SELECT id, name
    FROM roles
    ORDER BY name ASC
  `).all();
  return r.results || [];
}

async function listMenus(env){
  const r = await env.DB.prepare(`
    SELECT
      m.id,
      m.code,
      m.label,
      m.path,
      m.parent_id,
      m.sort_order,
      m.icon,
      m.created_at,
      p.label AS parent_label
    FROM menus m
    LEFT JOIN menus p ON p.id = m.parent_id
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).all();
  return r.results || [];
}

async function listRoleMenus(env, roleId){
  const r = await env.DB.prepare(`
    SELECT menu_id
    FROM role_menus
    WHERE role_id=?
  `).bind(roleId).all();
  return (r.results || []).map(x => String(x.menu_id));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const url = new URL(request.url);
  const role_id = String(url.searchParams.get("role_id") || "").trim();

  const [roles, menus] = await Promise.all([
    listRoles(env),
    listMenus(env)
  ]);

  let menu_ids = [];
  if(role_id){
    menu_ids = await listRoleMenus(env, role_id);
  }

  return json(200, "ok", {
    roles,
    menus,
    menu_ids
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const role_id = String(body.role_id || "").trim();
  const menu_ids = Array.isArray(body.menu_ids) ? [...new Set(body.menu_ids.map(String).filter(Boolean))] : [];

  if(!role_id){
    return json(400, "invalid_input", { message:"role_id_required" });
  }

  const role = await env.DB.prepare(`
    SELECT id, name FROM roles WHERE id=? LIMIT 1
  `).bind(role_id).first();

  if(!role){
    return json(404, "not_found", { message:"role_not_found" });
  }

  await env.DB.prepare(`
    DELETE FROM role_menus
    WHERE role_id=?
  `).bind(role_id).run();

  const now = nowSec();
  for(const menu_id of menu_ids){
    await env.DB.prepare(`
      INSERT INTO role_menus (role_id, menu_id, created_at)
      VALUES (?, ?, ?)
    `).bind(role_id, menu_id, now).run();
  }

  return json(200, "ok", {
    saved: true,
    role_id,
    total: menu_ids.length,
    menu_ids
  });
}

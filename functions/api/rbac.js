import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

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
    SELECT id, code, label, path, parent_id, sort_order, icon, created_at
    FROM menus
    ORDER BY sort_order ASC, created_at ASC
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

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const role_id = String(url.searchParams.get("role_id") || "").trim();

  const roles = await listRoles(env);
  const menus = await listMenus(env);

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

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const role_id = String(body.role_id || "").trim();
  const menu_ids = Array.isArray(body.menu_ids) ? body.menu_ids.map(String).filter(Boolean) : [];

  if(!role_id){
    return json(400, "invalid_input", { message:"role_id_required" });
  }

  const now = nowSec();

  await env.DB.prepare(`
    DELETE FROM role_menus
    WHERE role_id=?
  `).bind(role_id).run();

  for(const menu_id of menu_ids){
    await env.DB.prepare(`
      INSERT INTO role_menus (role_id, menu_id, created_at)
      VALUES (?,?,?)
    `).bind(role_id, menu_id, now).run();
  }

  return json(200, "ok", {
    saved: true,
    role_id,
    menu_ids
  });
}

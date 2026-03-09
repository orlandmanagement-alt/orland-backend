import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const rolesR = await env.DB.prepare(`SELECT id,name FROM roles ORDER BY name ASC`).all();
  const menusR = await env.DB.prepare(`
    SELECT id,code,label,path,parent_id,sort_order,icon,created_at
    FROM menus
    ORDER BY sort_order ASC, created_at ASC
  `).all();
  const rmR = await env.DB.prepare(`SELECT role_id, menu_id FROM role_menus`).all();

  const roleMenus = {};
  for(const x of (rmR.results||[])){
    const k = String(x.role_id);
    if(!roleMenus[k]) roleMenus[k] = [];
    roleMenus[k].push(String(x.menu_id));
  }

  return json(200,"ok",{
    roles: rolesR.results||[],
    menus: menusR.results||[],
    role_menus: roleMenus
  });
}

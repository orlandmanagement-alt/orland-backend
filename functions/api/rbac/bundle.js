import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const roles = await env.DB.prepare(`SELECT id,name FROM roles ORDER BY name ASC`).all();
  const menus = await env.DB.prepare(`
    SELECT id,code,label,path,parent_id,sort_order,icon,created_at
    FROM menus
    ORDER BY sort_order ASC, created_at ASC
  `).all();

  const role_menus = await env.DB.prepare(`
    SELECT role_id, menu_id FROM role_menus
  `).all();

  return json(200,"ok",{
    roles: roles.results||[],
    menus: menus.results||[],
    role_menus: role_menus.results||[]
  });
}

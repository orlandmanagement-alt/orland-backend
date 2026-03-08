import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function canManage(a){
  return hasRole(a.roles, ["super_admin","admin"]);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const role_id = String(body.role_id || "").trim();
  const menu_ids = Array.isArray(body.menu_ids) ? body.menu_ids.map(x=>String(x||"").trim()).filter(Boolean) : [];

  if(!role_id) return json(400,"invalid_input",{ message:"role_id_required" });

  const now = nowSec();

  // delete existing
  await env.DB.prepare(`DELETE FROM role_menus WHERE role_id=?`).bind(role_id).run();

  // insert new
  for(const mid of menu_ids){
    await env.DB.prepare(`
      INSERT OR IGNORE INTO role_menus (role_id,menu_id,created_at)
      VALUES (?,?,?)
    `).bind(role_id, mid, now).run();
  }

  return json(200,"ok",{ saved:true, role_id, count: menu_ids.length });
}

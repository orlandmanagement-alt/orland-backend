import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const b = await readJson(request) || {};
  const role_id = String(b.role_id||"").trim();
  const menu_ids = Array.isArray(b.menu_ids) ? b.menu_ids.map(x=>String(x)).filter(Boolean) : [];

  if(!role_id) return json(400,"invalid_input",{message:"role_id_required"});
  if(!menu_ids.length) return json(400,"invalid_input",{message:"menu_ids_required"});

  // ensure role exists
  const rr = await env.DB.prepare("SELECT id FROM roles WHERE id=? LIMIT 1").bind(role_id).first();
  if(!rr) return json(400,"invalid_input",{message:"role_not_found"});

  const now = nowSec();

  // delete old
  await env.DB.prepare("DELETE FROM role_menus WHERE role_id=?").bind(role_id).run();

  // insert new
  const stmt = env.DB.prepare("INSERT OR IGNORE INTO role_menus (role_id,menu_id,created_at) VALUES (?,?,?)");
  for(const mid of menu_ids){
    await stmt.bind(role_id, mid, now).run();
  }

  return json(200,"ok",{ updated:true, role_id, count: menu_ids.length });
}

import { json, requireAuth, hasRole } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin"]); }

async function all(env, sql){
  const r = await env.DB.prepare(sql).all();
  return r.results || [];
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  // Export scope: config/admin (NOT huge tenant/talent datasets)
  const payload = {
    version: 1,
    exported_at: Math.floor(Date.now()/1000),
    tables: {
      roles: await all(env, "SELECT id,name,created_at FROM roles ORDER BY created_at ASC"),
      menus: await all(env, "SELECT id,code,label,path,parent_id,sort_order,icon,created_at FROM menus ORDER BY sort_order ASC, created_at ASC"),
      role_menus: await all(env, "SELECT role_id,menu_id,created_at FROM role_menus ORDER BY created_at ASC"),
      user_roles: await all(env, "SELECT user_id,role_id,created_at FROM user_roles ORDER BY created_at ASC"),
      system_settings: await all(env, "SELECT k,v,is_secret,updated_at FROM system_settings ORDER BY k ASC"),
      alert_rules: await all(env, "SELECT id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at FROM alert_rules ORDER BY updated_at ASC"),
    }
  };

  return json(200,"ok", payload);
}

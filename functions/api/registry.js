import { json, requireAuth, hasRole } from "../_lib.js";

function normPath(p){
  p = String(p || "/").trim();
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/,"");
  return p || "/";
}
function moduleForCode(code){
  const safe = String(code||"").replace(/[^a-zA-Z0-9_]/g, "_");
  return "/modules/mod_" + safe + ".js";
}
async function getAllowedMenus(env, roles){
  if (hasRole(roles, ["super_admin"])) {
    const r = await env.DB.prepare(`
      SELECT id,code,label,path,parent_id,sort_order,icon,created_at
      FROM menus
      ORDER BY sort_order ASC, created_at ASC
    `).all();
    return r.results || [];
  }
  if (!roles.length) return [];
  const ph = roles.map(()=>"?").join(",");
  const r = await env.DB.prepare(`
    SELECT DISTINCT m.id,m.code,m.label,m.path,m.parent_id,m.sort_order,m.icon,m.created_at
    FROM role_menus rm
    JOIN roles ro ON ro.id=rm.role_id
    JOIN menus m ON m.id=rm.menu_id
    WHERE ro.name IN (${ph})
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).bind(...roles).all();
  return r.results || [];
}
export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const roles = Array.isArray(a.roles) ? a.roles.map(String) : [];
  if(!hasRole(roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const menus = await getAllowedMenus(env, roles);
  const routes = {};
  for(const m of (menus||[])){
    if(!m?.code || !m?.path) continue;
    const path = normPath(m.path);
    routes[path] = { module: moduleForCode(m.code), export:"default", title: String(m.label || m.code) };
  }

  if (routes["/profile"] && !routes["/profile/security"]) {
    routes["/profile/security"] = { module: "/modules/mod_profile_security.js", export:"default", title:"Security & Password" };
  }
  if (routes["/security"] && !routes["/security/policy"]) {
    routes["/security/policy"] = { module: "/modules/mod_security_policy.js", export:"default", title:"Security Policy" };
  }

  return json(200,"ok",{ routes, count:Object.keys(routes).length, roles });
}
tions/blogspot/widgets") return "/modules/mod_blogspot_widgets.js";

  // Fallback: code convention
  const safe = String(code||"").trim().replace(/[^a-zA-Z0-9_]/g, "_");
  if (!safe) return "/modules/mod_placeholder.js";
  return "/modules/mod_" + safe + ".js";
}

async function getAllowedMenus(env, roles){
  if (hasRole(roles, ["super_admin"])) {
    const r = await env.DB.prepare(`
      SELECT id,code,label,path,parent_id,sort_order,icon,created_at
      FROM menus
      ORDER BY sort_order ASC, created_at ASC
    `).all();
    return r.results || [];
  }

  if (!roles.length) return [];

  const ph = roles.map(()=>"?").join(",");
  const r = await env.DB.prepare(`
    SELECT DISTINCT m.id,m.code,m.label,m.path,m.parent_id,m.sort_order,m.icon,m.created_at
    FROM role_menus rm
    JOIN roles ro ON ro.id=rm.role_id
    JOIN menus m ON m.id=rm.menu_id
    WHERE ro.name IN (${ph})
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).bind(...roles).all();

  return r.results || [];
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const roles = Array.isArray(a.roles) ? a.roles.map(String) : [];
  if (!hasRole(roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const menus = await getAllowedMenus(env, roles);
  const routes = {};

  for(const m of (menus||[])){
    if(!m?.path) continue;
    const path = normPath(m.path);
    routes[path] = {
      module: moduleForPath(path, m.code),
      export: "default",
      title: String(m.label || m.code || "Module")
    };
  }

  // Ensure common virtual routes exist
  if(routes["/profile"] && !routes["/profile/security"]){
    routes["/profile/security"] = { module:"/modules/mod_profile_security.js", export:"default", title:"Security & Password" };
  }
  if(routes["/security"] && !routes["/security/policy"]){
    routes["/security/policy"] = { module:"/modules/mod_security_policy.js", export:"default", title:"Security Policy" };
  }

  return json(200, "ok", { routes, roles, count: Object.keys(routes).length });
}

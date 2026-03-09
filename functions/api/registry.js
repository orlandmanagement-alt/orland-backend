import { json, requireAuth, hasRole } from "../_lib.js";

function normPath(p){
  p = String(p || "/").trim();
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/,"");
  return p || "/";
}

function safeCodeToModule(code){
  const c = String(code || "").trim();

  // parents (menu root)
  if (c === "users") return "/modules/mod_users.js";
  if (c === "ops") return "/modules/mod_ops.js";
  if (c === "data") return "/modules/mod_data.js";
  if (c === "config") return "/modules/mod_config.js";
  if (c === "blogspot") return "/modules/mod_blogspot.js";

  // config children aliases (DB code -> module)
  if (c === "cfg_plugins") return "/modules/mod_cfg_plugins.js";
  if (c === "cfg_bulk_tools") return "/modules/mod_cfg_bulk_tools.js";
  if (c === "cfg_sec_policy") return "/modules/mod_cfg_sec_policy.js";
  if (c === "cfg_otp") return "/modules/mod_cfg_otp.js";
  if (c === "cfg_verify") return "/modules/mod_cfg_verify.js";

  // builder aliases
  if (c === "menu_builder" || c === "cfg_menubuilder") return "/modules/mod_menu_builder.js";
  if (c === "rbac_manager") return "/modules/mod_rbac_manager.js";

  // blogspot leaf codes
  if (c === "blogspot_settings") return "/modules/mod_blogspot_settings.js";
  if (c === "blogspot_posts") return "/modules/mod_blogspot_posts.js";
  if (c === "blogspot_pages") return "/modules/mod_blogspot_pages.js";
  if (c === "blogspot_widgets") return "/modules/mod_blogspot_widgets.js";

  // common known codes
  if (c === "dashboard") return "/modules/mod_dashboard.js";
  if (c === "audit") return "/modules/mod_audit.js";
  if (c === "security") return "/modules/mod_security.js";
  if (c === "ipblocks") return "/modules/mod_ipblocks.js";
  if (c === "rbac") return "/modules/mod_rbac.js";
  if (c === "menus") return "/modules/mod_menus.js";
  if (c === "profile") return "/modules/mod_profile.js";

  // default convention
  return "/modules/mod_" + c.replace(/[^a-zA-Z0-9_]/g, "_") + ".js";
}

async function getSessionRoles(env, request){
  const a = await requireAuth(env, request);
  if (!a.ok) return { ok:false, res:a.res, roles:[] };
  const roles = Array.isArray(a.roles) ? a.roles.map(String) : [];
  return { ok:true, res:null, roles };
}

async function getAllowedMenus(env, roles){
  // super_admin sees all
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

/**
 * /api/registry
 * Source of truth: D1 menus (+ role_menus)
 * Convention: menu.code => module resolver safeCodeToModule(code)
 */
export async function onRequestGet({ request, env }){
  const s = await getSessionRoles(env, request);
  if (!s.ok) return s.res;

  if (!hasRole(s.roles, ["super_admin","admin","staff"])) {
    return json(403, "forbidden", null);
  }

  const menus = await getAllowedMenus(env, s.roles);

  const routes = {};
  for (const m of (menus || [])){
    const code = String(m.code || "").trim();
    const path = normPath(m.path || "/");
    if (!code || !path) continue;

    routes[path] = {
      module: safeCodeToModule(code),
      export: "default",
      title: String(m.label || code)
    };
  }

  // virtual routes (optional)
  if (routes["/profile"] && !routes["/profile/security"]) {
    routes["/profile/security"] = {
      module: "/modules/mod_profile_security.js",
      export: "default",
      title: "Security & Password"
    };
  }
  if (routes["/security"] && !routes["/security/policy"]) {
    routes["/security/policy"] = {
      module: "/modules/mod_security_policy.js",
      export: "default",
      title: "Security Policy"
    };
  }

  return json(200, "ok", {
    routes,
    roles: s.roles,
    count: Object.keys(routes).length
  });
}

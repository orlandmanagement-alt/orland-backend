import { json, requireAuth, hasRole } from "../_lib.js";

function normPath(p){
  p = String(p || "/").trim();
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/,"");
  return p || "/";
}

function moduleForCode(code){
  const c = String(code || "").trim();

  if (c === "users") return "/modules/mod_users.js";
  if (c === "ops") return "/modules/mod_ops.js";
  if (c === "data") return "/modules/mod_data.js";
  if (c === "config") return "/modules/mod_config.js";
  if (c === "blogspot") return "/modules/mod_blogspot.js";

  if (c === "cfg_plugins") return "/modules/mod_cfg_plugins.js";
  if (c === "cfg_bulk_tools") return "/modules/mod_cfg_bulk_tools.js";
  if (c === "cfg_sec_policy") return "/modules/mod_cfg_sec_policy.js";
  if (c === "cfg_otp") return "/modules/mod_cfg_otp.js";
  if (c === "cfg_verify") return "/modules/mod_cfg_verify.js";
  if (c === "cfg_analytics") return "/modules/mod_cfg_analytics.js";

  if (c === "menu_builder" || c === "cfg_menubuilder") return "/modules/mod_menu_builder.js";
  if (c === "rbac_manager") return "/modules/mod_rbac_manager.js";

  if (c === "dashboard") return "/modules/mod_dashboard.js";
  if (c === "audit") return "/modules/mod_audit.js";
  if (c === "security") return "/modules/mod_security.js";
  if (c === "ipblocks") return "/modules/mod_ipblocks.js";
  if (c === "rbac") return "/modules/mod_rbac.js";
  if (c === "menus") return "/modules/mod_menus.js";
  if (c === "profile") return "/modules/mod_profile.js";

  if (c === "blogspot_settings") return "/modules/mod_blogspot_settings.js";
  if (c === "blogspot_posts") return "/modules/mod_blogspot_posts.js";
  if (c === "blogspot_pages") return "/modules/mod_blogspot_pages.js";
  if (c === "blogspot_widgets") return "/modules/mod_blogspot_widgets.js";

  return "/modules/mod_" + c.replace(/[^a-zA-Z0-9_]/g, "_") + ".js";
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
  if (!a.ok) return a.res;

  const roles = Array.isArray(a.roles) ? a.roles.map(String) : [];
  if (!hasRole(roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const menus = await getAllowedMenus(env, roles);
  const routes = {};

  for (const m of (menus || [])){
    const code = String(m.code || "").trim();
    const path = normPath(m.path || "/");
    if (!code || !path) continue;

    routes[path] = {
      module: moduleForCode(code),
      export: "default",
      title: String(m.label || code)
    };
  }

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
    roles,
    count: Object.keys(routes).length
  });
}

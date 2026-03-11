import { json, requireAuth, hasRole } from "../../_lib.js";

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/,"");
  return p || "/";
}

function guessModuleByCodeOrPath(code, path){
  const c = String(code || "").trim().toLowerCase();
  const p = normPath(path);

  const codeMap = {
    dashboard: "/modules/mod_dashboard.js",

    users: "/modules/mod_users.js",
    users_admin: "/modules/mod_users_admin.js",
    users_client: "/modules/mod_users_client.js",
    users_talent: "/modules/mod_users_talent.js",
    users_tenant: "/modules/mod_users_tenant.js",

    ops: "/modules/mod_ops.js",
    ops_incidents: "/modules/mod_ops_incidents.js",
    ops_oncall: "/modules/mod_ops_oncall.js",

    audit: "/modules/mod_audit.js",
    security: "/modules/mod_security.js",
    security_policy: "/modules/mod_security_policy.js",
    ipblocks: "/modules/mod_ipblocks.js",

    rbac: "/modules/mod_rbac.js",
    rbac_manager: "/modules/mod_rbac_manager.js",

    menus: "/modules/mod_menu_builder.js",
    menu_builder: "/modules/mod_menu_builder.js",

    cfg_plugins: "/modules/mod_cfg_plugins.js",
    cfg_bulk_tools: "/modules/mod_cfg_bulk_tools.js",
    cfg_sec_policy: "/modules/mod_cfg_sec_policy.js",
    cfg_otp: "/modules/mod_cfg_otp.js",
    cfg_verify: "/modules/mod_cfg_verify.js",
    cfg_analytics: "/modules/mod_cfg_analytics.js",
    cfg_blogspot: "/modules/mod_cfg_blogspot.js",

    blogspot: "/modules/mod_blogspot.js",
    blogspot_posts: "/modules/mod_blogspot_posts.js",
    blogspot_pages: "/modules/mod_blogspot_pages.js",
    blogspot_widgets: "/modules/mod_blogspot_widgets.js",
    blogspot_sync: "/modules/mod_blogspot_sync.js",

    data: "/modules/mod_data.js",
    data_export: "/modules/mod_data_export.js",
    data_import: "/modules/mod_data_import.js",

    profile: "/modules/mod_profile.js",
    profile_security: "/modules/mod_profile_security.js",

    plugins: "/modules/mod_plugins.js"
  };

  if(codeMap[c]) return codeMap[c];

  const pathMap = {
    "/dashboard": "/modules/mod_dashboard.js",

    "/users": "/modules/mod_users.js",
    "/users/admin": "/modules/mod_users_admin.js",
    "/users/client": "/modules/mod_users_client.js",
    "/users/talent": "/modules/mod_users_talent.js",
    "/users/tenant": "/modules/mod_users_tenant.js",

    "/ops": "/modules/mod_ops.js",
    "/ops/incidents": "/modules/mod_ops_incidents.js",
    "/ops/oncall": "/modules/mod_ops_oncall.js",

    "/audit": "/modules/mod_audit.js",
    "/security": "/modules/mod_security.js",
    "/security/policy": "/modules/mod_security_policy.js",
    "/ipblocks": "/modules/mod_ipblocks.js",

    "/rbac": "/modules/mod_rbac.js",
    "/rbac/manager": "/modules/mod_rbac_manager.js",

    "/menus": "/modules/mod_menu_builder.js",
    "/menu-builder": "/modules/mod_menu_builder.js",

    "/config/plugins": "/modules/mod_cfg_plugins.js",
    "/config/bulk-tools": "/modules/mod_cfg_bulk_tools.js",
    "/config/security-policy": "/modules/mod_cfg_sec_policy.js",
    "/config/otp": "/modules/mod_cfg_otp.js",
    "/config/verify": "/modules/mod_cfg_verify.js",
    "/config/analytics": "/modules/mod_cfg_analytics.js",

    "/integrations/blogspot": "/modules/mod_blogspot.js",
    "/integrations/blogspot/settings": "/modules/mod_cfg_blogspot.js",
    "/integrations/blogspot/posts": "/modules/mod_blogspot_posts.js",
    "/integrations/blogspot/pages": "/modules/mod_blogspot_pages.js",
    "/integrations/blogspot/widgets": "/modules/mod_blogspot_widgets.js",
    "/integrations/blogspot/sync": "/modules/mod_blogspot_sync.js",

    "/data": "/modules/mod_data.js",
    "/data/export": "/modules/mod_data_export.js",
    "/data/import": "/modules/mod_data_import.js",

    "/profile": "/modules/mod_profile.js",
    "/profile/security": "/modules/mod_profile_security.js",

    "/plugins": "/modules/mod_plugins.js"
  };

  if(pathMap[p]) return pathMap[p];

  return "/modules/mod_placeholder.js";
}

async function getMenusForRoles(env, roles){
  if(hasRole(roles, ["super_admin"])){
    const r = await env.DB.prepare(`
      SELECT id, code, label, path
      FROM menus
      ORDER BY sort_order ASC, created_at ASC
    `).all();
    return r.results || [];
  }

  const cleanRoles = (roles || []).map(String).filter(Boolean);
  if(!cleanRoles.length) return [];

  const ph = cleanRoles.map(() => "?").join(",");
  const r = await env.DB.prepare(`
    SELECT DISTINCT m.id, m.code, m.label, m.path
    FROM role_menus rm
    JOIN roles r ON r.id = rm.role_id
    JOIN menus m ON m.id = rm.menu_id
    WHERE r.name IN (${ph})
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).bind(...cleanRoles).all();

  return r.results || [];
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin","staff"])){
    return json(403, "forbidden", null);
  }

  const rows = await getMenusForRoles(env, a.roles || []);
  const routes = {};

  for(const row of rows){
    const p = normPath(row.path || "/");
    if(!p || p === "/") continue;

    routes[p] = {
      module: guessModuleByCodeOrPath(row.code, p),
      export: "default",
      title: String(row.label || row.code || p)
    };
  }

  return json(200, "ok", {
    routes,
    total: Object.keys(routes).length
  });
}

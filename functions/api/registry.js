import { json, requireAuth, hasRole } from "../_lib.js";

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/,"");
  return p || "/";
}

function mapCodeToModule(code, path){
  const c = String(code || "").trim().toLowerCase();
  const p = normPath(path);

  const CODE_MAP = {
/* __ORLAND_ALIAS_CODEMAP_PATCH__ */
    blogspot_settings: "/modules/mod_cfg_blogspot.js",
    bulk_tools: "/modules/mod_cfg_bulk_tools.js",
    config_plugins: "/modules/mod_cfg_plugins.js",
    oncall_groups: "/modules/mod_ops_oncall.js",
    users_root: "/modules/mod_users_admin.js",
    invites_talent: "/modules/mod_invites_talent.js",
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
    ipblocks: "/modules/mod_ipblocks.js",

    rbac: "/modules/mod_rbac.js",
    rbac_manager: "/modules/mod_rbac_manager.js",

    security: "/modules/mod_security.js",
    security_policy: "/modules/mod_security_policy.js",

    menus: "/modules/mod_menus.js",
    menu_builder: "/modules/mod_menu_builder.js",

    profile: "/modules/mod_profile.js",
    profile_security: "/modules/mod_profile_security.js",

    config: "/modules/mod_config.js",
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

    data: "/modules/mod_data.js",
    data_export: "/modules/mod_data_export.js",
    data_import: "/modules/mod_data_import.js",

    plugins: "/modules/mod_plugins.js"
  };

  if(CODE_MAP[c]) return CODE_MAP[c];

  const PATH_MAP = {
    "/": "/modules/mod_dashboard.js",
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
    "/ipblocks": "/modules/mod_ipblocks.js",

    "/rbac": "/modules/mod_rbac.js",
    "/rbac/manager": "/modules/mod_rbac_manager.js",

    "/security": "/modules/mod_security.js",
    "/security/policy": "/modules/mod_security_policy.js",

    "/menus": "/modules/mod_menus.js",
    "/menu-builder": "/modules/mod_menu_builder.js",

    "/profile": "/modules/mod_profile.js",
    "/profile/security": "/modules/mod_profile_security.js",

    "/config": "/modules/mod_config.js",
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

    "/data": "/modules/mod_data.js",
    "/data/export": "/modules/mod_data_export.js",
    "/data/import": "/modules/mod_data_import.js",

    "/plugins": "/modules/mod_plugins.js"
  };

  if(PATH_MAP[p]) return PATH_MAP[p];
  return "/modules/mod_placeholder.js";
}

async function getAllowedMenus(env, roles){
  if(hasRole(roles, ["super_admin"])){
    const r = await env.DB.prepare(`
      SELECT id, code, label, path, parent_id, sort_order, icon, created_at
      FROM menus
      ORDER BY sort_order ASC, created_at ASC
    `).all();
    return r.results || [];
  }

  const ph = roles.map(()=>"?").join(",");
  if(!ph) return [];

  const r = await env.DB.prepare(`
    SELECT DISTINCT
      m.id, m.code, m.label, m.path, m.parent_id, m.sort_order, m.icon, m.created_at
    FROM role_menus rm
    JOIN roles r ON r.id = rm.role_id
    JOIN menus m ON m.id = rm.menu_id
    WHERE r.name IN (${ph})
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).bind(...roles).all();

  return r.results || [];
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const rows = await getAllowedMenus(env, a.roles || []);
  const routes = {};

  for(const row of rows){
    const path = normPath(row.path || "/");
    routes[path] = {
      module: mapCodeToModule(row.code, path),
      export: "default",
      title: String(row.label || row.code || path)
    };
  }

  const ensured = {
    "/dashboard": "/modules/mod_dashboard.js",
    "/ops": "/modules/mod_ops.js",
    "/ops/incidents": "/modules/mod_ops_incidents.js",
    "/ops/oncall": "/modules/mod_ops_oncall.js",
    "/security": "/modules/mod_security.js",
    "/security/policy": "/modules/mod_security_policy.js",
    "/rbac": "/modules/mod_rbac.js",
    "/audit": "/modules/mod_audit.js",
    "/ipblocks": "/modules/mod_ipblocks.js",
    "/config/analytics": "/modules/mod_cfg_analytics.js",
    "/integrations/blogspot": "/modules/mod_blogspot.js",
    "/integrations/blogspot/settings": "/modules/mod_cfg_blogspot.js",
    "/integrations/blogspot/posts": "/modules/mod_blogspot_posts.js",
    "/integrations/blogspot/pages": "/modules/mod_blogspot_pages.js",
    "/integrations/blogspot/widgets": "/modules/mod_blogspot_widgets.js",
    "/data/export": "/modules/mod_data_export.js",
    "/data/import": "/modules/mod_data_import.js",
    "/profile": "/modules/mod_profile.js",
    "/profile/security": "/modules/mod_profile_security.js"
  };

  for(const [path, module] of Object.entries(ensured)){
    if(!routes[path]){
      routes[path] = { module, export: "default", title: path };
    }
  }

  return json(200,"ok",{ routes, total: Object.keys(routes).length });
}

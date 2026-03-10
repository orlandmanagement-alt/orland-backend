import { json, requireAuth, hasRole } from "../_lib.js";

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/,"");
  return p || "/";
}

function normalizeMenuCode(code){
  let c = String(code || "").trim().toLowerCase();
  if(!c) return "";

  c = c.replace(/^m_(core|cfg|config|sys|system|int|integrations|integration)_/, "");
  c = c.replace(/[^a-z0-9_]+/g, "_");
  c = c.replace(/^_+|_+$/g, "");
  return c;
}

function guessModuleByCodeOrPath(code, path){
  const c = normalizeMenuCode(code);
  const p = normPath(path);

  const codeMap = {
    dashboard: "/modules/mod_dashboard.js",

    users: "/modules/mod_users.js",
    users_admin: "/modules/mod_users_admin.js",
    users_client: "/modules/mod_users_client.js",
    users_talent: "/modules/mod_users_talent.js",
    users_tenant: "/modules/mod_users_tenant.js",

    rbac: "/modules/mod_rbac.js",

    audit: "/modules/mod_audit.js",

    security: "/modules/mod_security.js",
    security_policy: "/modules/mod_security_policy.js",

    ops: "/modules/mod_ops.js",
    ops_incidents: "/modules/mod_ops_incidents.js",
    ops_oncall: "/modules/mod_ops_oncall.js",

    config: "/modules/mod_config.js",
    cfg_plugins: "/modules/mod_cfg_plugins.js",
    cfg_bulk_tools: "/modules/mod_cfg_bulk_tools.js",
    cfg_otp: "/modules/mod_cfg_otp.js",
    cfg_verify: "/modules/mod_cfg_verify.js",
    cfg_sec_policy: "/modules/mod_cfg_sec_policy.js",
    cfg_analytics: "/modules/mod_cfg_analytics.js",
    cfg_blogspot: "/modules/mod_cfg_blogspot.js",

    blogspot: "/modules/mod_blogspot.js",
    blogspot_posts: "/modules/mod_blogspot_posts.js",
    blogspot_pages: "/modules/mod_blogspot_pages.js",
    blogspot_widgets: "/modules/mod_blogspot_widgets.js",

    data: "/modules/mod_data.js",
    data_export: "/modules/mod_data_export.js",
    data_import: "/modules/mod_data_import.js",

    ipblocks: "/modules/mod_ipblocks.js",

    menus: "/modules/mod_menus.js",
    menu_builder: "/modules/mod_menu_builder.js",

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

    "/rbac": "/modules/mod_rbac.js",

    "/audit": "/modules/mod_audit.js",

    "/security": "/modules/mod_security.js",
    "/security/policy": "/modules/mod_security_policy.js",

    "/ops": "/modules/mod_ops.js",
    "/ops/incidents": "/modules/mod_ops_incidents.js",
    "/ops/oncall": "/modules/mod_ops_oncall.js",

    "/config": "/modules/mod_config.js",
    "/config/plugins": "/modules/mod_cfg_plugins.js",
    "/config/bulk-tools": "/modules/mod_cfg_bulk_tools.js",
    "/config/otp": "/modules/mod_cfg_otp.js",
    "/config/verify": "/modules/mod_cfg_verify.js",
    "/config/security-policy": "/modules/mod_cfg_sec_policy.js",
    "/config/analytics": "/modules/mod_cfg_analytics.js",
    "/config/blogspot": "/modules/mod_cfg_blogspot.js",

    "/integrations/blogspot": "/modules/mod_blogspot.js",
    "/integrations/blogspot/settings": "/modules/mod_cfg_blogspot.js",
    "/integrations/blogspot/posts": "/modules/mod_blogspot_posts.js",
    "/integrations/blogspot/pages": "/modules/mod_blogspot_pages.js",
    "/integrations/blogspot/widgets": "/modules/mod_blogspot_widgets.js",

    "/data": "/modules/mod_data.js",
    "/data/export": "/modules/mod_data_export.js",
    "/data/import": "/modules/mod_data_import.js",

    "/ipblocks": "/modules/mod_ipblocks.js",

    "/menus": "/modules/mod_menus.js",
    "/menu-builder": "/modules/mod_menu_builder.js",

    "/profile": "/modules/mod_profile.js",
    "/profile/security": "/modules/mod_profile_security.js",

    "/plugins": "/modules/mod_plugins.js"
  };

  if(pathMap[p]) return pathMap[p];

  return "/modules/mod_placeholder.js";
}

async function getAllMenus(env){
  const r = await env.DB.prepare(`
    SELECT id, code, label, path, parent_id, sort_order, created_at
    FROM menus
    ORDER BY sort_order ASC, created_at ASC
  `).all();
  return r.results || [];
}

async function getMenusForRoles(env, roles){
  const allMenus = await getAllMenus(env);

  if(hasRole(roles, ["super_admin"])){
    return allMenus;
  }

  const cleanRoles = (roles || []).map(String).filter(Boolean);
  if(!cleanRoles.length) return [];

  const ph = cleanRoles.map(() => "?").join(",");
  const allowed = await env.DB.prepare(`
    SELECT DISTINCT m.id
    FROM role_menus rm
    JOIN roles r ON r.id = rm.role_id
    JOIN menus m ON m.id = rm.menu_id
    WHERE r.name IN (${ph})
  `).bind(...cleanRoles).all();

  const allowedIds = new Set((allowed.results || []).map(x => String(x.id)));
  if(!allowedIds.size) return [];

  const byId = new Map(allMenus.map(row => [String(row.id), row]));

  for(const id of Array.from(allowedIds)){
    let cur = byId.get(id);
    while(cur && cur.parent_id){
      const pid = String(cur.parent_id);
      if(allowedIds.has(pid)) break;
      allowedIds.add(pid);
      cur = byId.get(pid);
    }
  }

  return allMenus.filter(row => allowedIds.has(String(row.id)));
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

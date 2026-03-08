import { json, requireAuth, hasRole } from "../_lib.js";

/**
 * Registry runtime (RBAC-aware) from D1 table menus.
 * - All menu paths become routes.
 * - If path has no module mapping -> use placeholder module.
 * - Parent paths (/users, /ops, /data, /config, /integrations/blogspot) auto map to first child.
 */

function moduleForPath(p){
  const map = {
    "/dashboard": "/modules/mod_dashboard.js",

    "/users/admin": "/modules/mod_users_admin.js",
    "/users/client": "/modules/mod_users_client.js",
    "/users/talent": "/modules/mod_users_talent.js",
    "/users/tenant": "/modules/mod_users_tenant.js",

    "/rbac": "/modules/mod_rbac.js",
    "/menus": "/modules/mod_menus.js",

    "/security": "/modules/mod_security.js",
    "/security/policy": "/modules/mod_security_policy.js",

    "/ops/incidents": "/modules/mod_ops_incidents.js",
    "/ops/oncall": "/modules/mod_ops_oncall.js",

    "/audit": "/modules/mod_audit.js",

    "/data/export": "/modules/mod_data_export.js",
    "/data/import": "/modules/mod_data_import.js",

    "/ipblocks": "/modules/mod_ipblocks.js",

    "/config/plugins": "/modules/mod_plugins.js",

    "/profile": "/modules/mod_profile.js",
    "/profile/security": "/modules/mod_profile_security.js",

    "/integrations/blogspot/settings": "/modules/mod_blogspot_settings.js",
    "/integrations/blogspot/posts": "/modules/mod_blogspot_posts.js",
    "/integrations/blogspot/pages": "/modules/mod_blogspot_pages.js",
    "/integrations/blogspot/widgets": "/modules/mod_blogspot_widgets.js",

    "/invites/talent": "/modules/mod_invites_talent.js",
    "/ops/bulk-tools": "/modules/mod_bulk_tools.js",
  };
  return map[p] || null;
}

function normPath(x){
  const p = String(x || "").trim();
  if(!p) return "/";
  return (p.startsWith("/") ? p : "/"+p).replace(/\/+$/,"") || "/";
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const roles = Array.isArray(a.roles) ? a.roles.map(String) : [];
  let rows = [];

  if (hasRole(roles, ["super_admin"])) {
    const r = await env.DB.prepare(`
      SELECT id,code,label,path,parent_id,sort_order,created_at
      FROM menus
      ORDER BY sort_order ASC, created_at ASC
    `).all();
    rows = r.results || [];
  } else {
    if(!roles.length) return json(200,"ok",{ routes:{} });

    const ph = roles.map(()=>"?").join(",");
    const r = await env.DB.prepare(`
      SELECT DISTINCT m.id,m.code,m.label,m.path,m.parent_id,m.sort_order,m.created_at
      FROM role_menus rm
      JOIN roles ro ON ro.id=rm.role_id
      JOIN menus m ON m.id=rm.menu_id
      WHERE ro.name IN (${ph})
      ORDER BY m.sort_order ASC, m.created_at ASC
    `).bind(...roles).all();
    rows = r.results || [];
  }

  // Build children map to resolve parent -> first child
  const byId = new Map(rows.map(x=>[String(x.id), x]));
  const children = new Map(); // parent_id -> [menuRow]
  for(const m of rows){
    const pid = m.parent_id ? String(m.parent_id) : null;
    if(!pid) continue;
    const arr = children.get(pid) || [];
    arr.push(m);
    children.set(pid, arr);
  }
  for(const [pid, arr] of children){
    arr.sort((a,b)=>{
      const sa = Number(a.sort_order ?? 9999), sb = Number(b.sort_order ?? 9999);
      if(sa!==sb) return sa-sb;
      return Number(a.created_at ?? 0) - Number(b.created_at ?? 0);
    });
  }

  const routes = {};

  // Insert all menu paths as routes (fallback placeholder)
  for(const m of rows){
    const p = normPath(m.path);
    const mod = moduleForPath(p) || "/modules/mod_placeholder.js";
    routes[p] = { module: mod, export: "default", title: String(m.label || m.code || p) };
  }

  // Auto parent routing -> first child if exists
  for(const m of rows){
    const id = String(m.id);
    const p = normPath(m.path);
    const kids = children.get(id) || [];
    if(!kids.length) continue;
    const firstChildPath = normPath(kids[0].path);
    if(routes[firstChildPath]){
      routes[p] = routes[firstChildPath]; // parent opens first child module
    }
  }

  // Common aliases
  if(routes["/users/admin"]) routes["/users"] = routes["/users/admin"];
  if(routes["/ops/incidents"]) routes["/ops"] = routes["/ops/incidents"];
  if(routes["/data/export"]) routes["/data"] = routes["/data/export"];
  if(routes["/integrations/blogspot/settings"]) routes["/integrations/blogspot"] = routes["/integrations/blogspot/settings"];
  if(routes["/config/plugins"]) routes["/config"] = routes["/config/plugins"];

  // Root default
  routes["/"] = routes["/dashboard"] || routes["/users"] || null;

  return json(200,"ok",{ routes });
}

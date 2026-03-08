import { json, requireAuth } from "../_lib.js";

// keep server registry in sync with public/modules/registry.js
export const Registry = {
  routes: {
    "/dashboard":        { module: "/modules/mod_dashboard.js", export: "default", title: "Dashboard" },

    "/users/admin":      { module: "/modules/mod_users_admin.js", export: "default", title: "Admin Users" },
    "/users/client":     { module: "/modules/mod_users_client.js", export: "default", title: "Client Users" },
    "/users/talent":     { module: "/modules/mod_users_talent.js", export: "default", title: "Talent Directory" },
    "/users/tenant":     { module: "/modules/mod_users_tenant.js", export: "default", title: "Tenant Mapping" },

    "/projects":         { module: "/modules/mod_projects.js", export: "default", title: "Projects / Jobs" },

    "/menus":            { module: "/modules/mod_menus.js", export: "default", title: "Menu Builder" },
    "/rbac":             { module: "/modules/mod_rbac.js", export: "default", title: "RBAC Manager" },

    "/audit":            { module: "/modules/mod_audit.js", export: "default", title: "Audit Logs" },
    "/security":         { module: "/modules/mod_security.js", export: "default", title: "Security" },

    "/ops/incidents":    { module: "/modules/mod_ops_incidents.js", export: "default", title: "Incidents & Alerts" },
    "/ops/oncall":       { module: "/modules/mod_ops_oncall.js", export: "default", title: "On-Call Schedule" },

    "/ipblocks":         { module: "/modules/mod_ipblocks.js", export: "default", title: "Banned / IP Blocks" },

    "/data/export":      { module: "/modules/mod_data_export.js", export: "default", title: "Export Data" },
    "/data/import":      { module: "/modules/mod_data_import.js", export: "default", title: "Import Data" },

    "/profile":          { module: "/modules/mod_profile.js", export: "default", title: "My Profile" },
    "/profile/security": { module: "/modules/mod_profile_security.js", export: "default", title: "Security & Password" },

    "/config/plugins":         { module: "/modules/mod_plugins.js", export: "default", title: "Plugins" },
    "/config/security-policy": { module: "/modules/mod_security_policy.js", export: "default", title: "Security Policy" },
    "/config/bulk-tools":      { module: "/modules/mod_bulk_tools.js", export: "default", title: "Bulk Tools" },

    "/integrations/blogspot/settings": { module: "/modules/mod_blogspot_settings.js", export: "default", title: "Blogspot API Settings" },
    "/integrations/blogspot/posts":    { module: "/modules/mod_blogspot_posts.js", export: "default", title: "Manage Posts" },
    "/integrations/blogspot/pages":    { module: "/modules/mod_blogspot_pages.js", export: "default", title: "Static Pages" },
    "/integrations/blogspot/widgets":  { module: "/modules/mod_blogspot_widgets.js", export: "default", title: "Widgets / Home" }
  }
};

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  return json(200, "ok", { Registry });
}

/**
 * Registry: map PATH -> module file + export function
 * Convention:
 *   module file exports: export async function mount(ctx) { ... }
 */
export const ROUTES = [
  // Core
  { path: "/dashboard", file: "/modules/mod_dashboard.js" },

  // Users area (UI only for now - you already have users module elsewhere)
  { path: "/users", file: "/modules/mod_users.js" },
  { path: "/users/admin", file: "/modules/mod_users_admin.js" },
  { path: "/users/client", file: "/modules/mod_users_client.js" },
  { path: "/users/talent", file: "/modules/mod_users_talent.js" },
  { path: "/users/tenant", file: "/modules/mod_users_tenant.js" },

  // Projects placeholder
  { path: "/projects", file: "/modules/mod_projects.js" },

  // RBAC
  { path: "/rbac", file: "/modules/mod_rbac.js" },

  // Audit
  { path: "/audit", file: "/modules/mod_audit.js" },

  // Security
  { path: "/security", file: "/modules/mod_security.js" },

  // Ops
  { path: "/ops", file: "/modules/mod_ops.js" },
  { path: "/ops/incidents", file: "/modules/mod_incidents.js" },
  { path: "/ops/oncall", file: "/modules/mod_oncall.js" },

  // Data
  { path: "/data", file: "/modules/mod_data.js" },
  { path: "/data/export", file: "/modules/mod_export.js" },
  { path: "/data/import", file: "/modules/mod_import.js" },

  // Config
  { path: "/config", file: "/modules/mod_config.js" },
  { path: "/config/otp", file: "/modules/mod_otp.js" },
  { path: "/config/verification", file: "/modules/mod_verification.js" },

  // IP Blocks
  { path: "/ipblocks", file: "/modules/mod_ipblocks.js" },

  // Menu Builder
  { path: "/menus", file: "/modules/mod_menus.js" },

  // Profile
  { path: "/profile", file: "/modules/mod_profile.js" },

  // Integrations: Blogspot
  { path: "/integrations/blogspot", file: "/modules/mod_blogspot_home.js" },
  { path: "/integrations/blogspot/settings", file: "/modules/mod_blogspot_settings.js" },
  { path: "/integrations/blogspot/posts", file: "/modules/mod_blogspot_posts.js" },
  { path: "/integrations/blogspot/pages", file: "/modules/mod_blogspot_pages.js" },
  { path: "/integrations/blogspot/widgets", file: "/modules/mod_blogspot_widgets.js" },
];

// Find best matching route (longest prefix match first)
export function resolveRoute(pathname){
  const p = String(pathname || "/").replace(/\/+$/,"") || "/";
  let best = null;
  for(const r of ROUTES){
    const rp = r.path.replace(/\/+$/,"") || "/";
    if(p === rp) {
      if(!best || rp.length > best.path.length) best = r;
    }
  }
  // fallback to /dashboard
  return best || { path: "/dashboard", file: "/modules/mod_dashboard.js" };
}
ROUTES['/ops/alert-rules'] = { title:'Alert Rules', module:'mod_alert_rules.js' };
ROUTES['/config/bulk-tools'] = { title:'Bulk Tools', module:'mod_bulk_tools.js' };
ROUTES['/profile'] = { title:'My Profile', module:'mod_profile.js' };
ROUTES['/profile/security'] = { title:'Security & Password', module:'mod_profile_security.js' };

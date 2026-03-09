export const Registry = {
  routes: {
    "/ops/oncall-groups": { module: "/modules/mod_oncall_groups.js", export: "default", title: "Oncall Groups" },

    // Core
    "/dashboard": { module: "/modules/mod_dashboard.js", export: "default", title: "Dashboard" },

    // Users
    "/users/admin":   { module: "/modules/mod_users_admin.js",  export: "default", title: "Admin Users" },
    "/users/client":  { module: "/modules/mod_users_client.js", export: "default", title: "Client Users" },
    "/users/talent":  { module: "/modules/mod_users_talent.js", export: "default", title: "Talent Directory" },
    "/users/tenant":  { module: "/modules/mod_users_tenant.js", export: "default", title: "Tenant Mapping" },

    // RBAC + Menus
    "/rbac":   { module: "/modules/mod_rbac.js",  export: "default", title: "RBAC Manager" },
    "/menus":  { module: "/modules/mod_menus.js", export: "default", title: "Menu Builder" },

    // Ops + Security + Audit
    "/security":       { module: "/modules/mod_security.js",       export: "default", title: "Security" },
    "/security/policy":{ module: "/modules/mod_security_policy.js",export: "default", title: "Security Policy" },

    "/ops/incidents":  { module: "/modules/mod_ops_incidents.js", export: "default", title: "Incidents & Alerts" },
    "/ops/oncall":     { module: "/modules/mod_ops_oncall.js",    export: "default", title: "On-Call Schedule" },

    "/audit":          { module: "/modules/mod_audit.js",         export: "default", title: "Audit Logs" },

    // Data
    "/data/export":    { module: "/modules/mod_data_export.js",   export: "default", title: "Export Data" },
    "/data/import":    { module: "/modules/mod_data_import.js",   export: "default", title: "Import Data" },

    // Config
    "/ipblocks":       { module: "/modules/mod_ipblocks.js",      export: "default", title: "Banned / IP Blocks" },
    "/config/plugins": { module: "/modules/mod_plugins.js",       export: "default", title: "Plugins" },

    // Profile
    "/profile":        { module: "/modules/mod_profile.js",          export: "default", title: "My Profile" },
    "/profile/security":{ module: "/modules/mod_profile_security.js", export: "default", title: "Security & Password" },

    // Invites (talent)
    "/invites/talent": { module: "/modules/mod_invites_talent.js", export: "default", title: "Invite Talent" },

    // Blogspot modules (kalau belum install plugin, tetap aman)
    "/integrations/blogspot/settings": { module: "/modules/mod_blogspot_settings.js", export: "default", title: "Blogspot API Settings" },
    "/integrations/blogspot/posts":    { module: "/modules/mod_blogspot_posts.js",    export: "default", title: "Manage Posts" },
    "/integrations/blogspot/pages":    { module: "/modules/mod_blogspot_pages.js",    export: "default", title: "Static Pages" },
    "/integrations/blogspot/widgets":  { module: "/modules/mod_blogspot_widgets.js",  export: "default", title: "Widgets / Home" },

    // Tools
    "/tools/bulk":     { module: "/modules/mod_bulk_tools.js",    export: "default", title: "Bulk Tools" },
  }
};

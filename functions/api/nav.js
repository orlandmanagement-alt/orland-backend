import { json, requireAuth, hasRole } from "../_lib.js";

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/");
  p = p.replace(/\/+$/,"");
  return p || "/";
}

function bucketOf(path){
  const p = normPath(path);

  if(
    p.startsWith("/integrations") ||
    p.startsWith("/plugins")
  ) return "integrations";

  if(
    p.startsWith("/ops") ||
    p.startsWith("/security") ||
    p.startsWith("/audit") ||
    p.startsWith("/data")
  ) return "system";

  if(
    p.startsWith("/config") ||
    p.startsWith("/rbac") ||
    p.startsWith("/menus") ||
    p.startsWith("/menu-builder") ||
    p.startsWith("/ipblocks") ||
    p.startsWith("/profile") ||
    p.startsWith("/users")
  ) return "config";

  return "core";
}

function sortMenus(a, b){
  const sa = Number(a.sort_order ?? 9999);
  const sb = Number(b.sort_order ?? 9999);
  if(sa !== sb) return sa - sb;
  return Number(a.created_at ?? 0) - Number(b.created_at ?? 0);
}

function buildTree(rows){
  const byId = new Map();
  const roots = [];

  for(const row of rows){
    byId.set(String(row.id), {
      id: row.id,
      code: row.code || "",
      label: row.label || row.code || row.path || "Menu",
      path: normPath(row.path || "/"),
      icon: row.icon || "fa-solid fa-circle-dot",
      parent_id: row.parent_id || null,
      sort_order: Number(row.sort_order ?? 9999),
      created_at: Number(row.created_at ?? 0),
      submenus: []
    });
  }

  for(const item of byId.values()){
    if(item.parent_id && byId.has(String(item.parent_id))){
      byId.get(String(item.parent_id)).submenus.push(item);
    }else{
      roots.push(item);
    }
  }

  const walk = (arr)=>{
    arr.sort(sortMenus);
    for(const x of arr){
      if(Array.isArray(x.submenus) && x.submenus.length){
        walk(x.submenus);
      }
    }
  };
  walk(roots);

  return roots;
}

function dedupeByPath(items){
  const seen = new Set();
  const out = [];

  for(const item of items){
    const key = String(item.path || "") + "|" + String(item.label || "");
    if(seen.has(key)) continue;
    seen.add(key);

    const next = { ...item };
    if(Array.isArray(next.submenus)){
      next.submenus = dedupeByPath(next.submenus);
    }
    out.push(next);
  }

  return out;
}

function pushIfMissing(grouped, bucket, item){
  const has = grouped[bucket].some(x => String(x.path) === String(item.path));
  if(!has) grouped[bucket].push(item);
}

function forceImportantMenus(grouped){
  pushIfMissing("dummy" && grouped, "core", {
    id: "__dashboard",
    code: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: "fa-solid fa-gauge-high",
    submenus: [],
    sort_order: 0,
    created_at: 0
  });

  pushIfMissing(grouped, "system", {
    id: "__ops",
    code: "ops",
    label: "Operations",
    path: "/ops",
    icon: "fa-solid fa-screwdriver-wrench",
    submenus: [
      {
        id: "__ops_incidents",
        code: "ops_incidents",
        label: "Incidents",
        path: "/ops/incidents",
        icon: "fa-solid fa-triangle-exclamation",
        submenus: [],
        sort_order: 1,
        created_at: 0
      },
      {
        id: "__ops_oncall",
        code: "ops_oncall",
        label: "Oncall",
        path: "/ops/oncall",
        icon: "fa-solid fa-user-clock",
        submenus: [],
        sort_order: 2,
        created_at: 0
      }
    ],
    sort_order: 10,
    created_at: 0
  });

  pushIfMissing(grouped, "system", {
    id: "__security",
    code: "security",
    label: "Security",
    path: "/security",
    icon: "fa-solid fa-shield-halved",
    submenus: [
      {
        id: "__security_policy",
        code: "security_policy",
        label: "Security Policy",
        path: "/security/policy",
        icon: "fa-solid fa-lock",
        submenus: [],
        sort_order: 1,
        created_at: 0
      }
    ],
    sort_order: 20,
    created_at: 0
  });

  pushIfMissing(grouped, "system", {
    id: "__data",
    code: "data",
    label: "Data",
    path: "/data",
    icon: "fa-solid fa-database",
    submenus: [
      {
        id: "__data_export",
        code: "data_export",
        label: "Export",
        path: "/data/export",
        icon: "fa-solid fa-file-export",
        submenus: [],
        sort_order: 1,
        created_at: 0
      },
      {
        id: "__data_import",
        code: "data_import",
        label: "Import",
        path: "/data/import",
        icon: "fa-solid fa-file-import",
        submenus: [],
        sort_order: 2,
        created_at: 0
      }
    ],
    sort_order: 30,
    created_at: 0
  });

  pushIfMissing(grouped, "config", {
    id: "__rbac",
    code: "rbac",
    label: "RBAC",
    path: "/rbac",
    icon: "fa-solid fa-users-gear",
    submenus: [
      {
        id: "__rbac_manager",
        code: "rbac_manager",
        label: "RBAC Manager",
        path: "/rbac/manager",
        icon: "fa-solid fa-user-shield",
        submenus: [],
        sort_order: 1,
        created_at: 0
      }
    ],
    sort_order: 10,
    created_at: 0
  });

  pushIfMissing(grouped, "config", {
    id: "__config",
    code: "config",
    label: "Configuration",
    path: "/config",
    icon: "fa-solid fa-sliders",
    submenus: [
      {
        id: "__config_plugins",
        code: "cfg_plugins",
        label: "Plugins",
        path: "/config/plugins",
        icon: "fa-solid fa-plug",
        submenus: [],
        sort_order: 1,
        created_at: 0
      },
      {
        id: "__config_bulk",
        code: "cfg_bulk_tools",
        label: "Bulk Tools",
        path: "/config/bulk-tools",
        icon: "fa-solid fa-toolbox",
        submenus: [],
        sort_order: 2,
        created_at: 0
      },
      {
        id: "__config_security_policy",
        code: "cfg_sec_policy",
        label: "Security Policy",
        path: "/config/security-policy",
        icon: "fa-solid fa-lock",
        submenus: [],
        sort_order: 3,
        created_at: 0
      },
      {
        id: "__config_otp",
        code: "cfg_otp",
        label: "OTP",
        path: "/config/otp",
        icon: "fa-solid fa-mobile-screen-button",
        submenus: [],
        sort_order: 4,
        created_at: 0
      },
      {
        id: "__config_verify",
        code: "cfg_verify",
        label: "Verify",
        path: "/config/verify",
        icon: "fa-solid fa-badge-check",
        submenus: [],
        sort_order: 5,
        created_at: 0
      },
      {
        id: "__config_analytics",
        code: "cfg_analytics",
        label: "Analytics Settings",
        path: "/config/analytics",
        icon: "fa-solid fa-chart-line",
        submenus: [],
        sort_order: 6,
        created_at: 0
      }
    ],
    sort_order: 20,
    created_at: 0
  });

  pushIfMissing(grouped, "config", {
    id: "__users",
    code: "users",
    label: "Users",
    path: "/users",
    icon: "fa-solid fa-users",
    submenus: [
      {
        id: "__users_admin",
        code: "users_admin",
        label: "Admin Users",
        path: "/users/admin",
        icon: "fa-solid fa-user-shield",
        submenus: [],
        sort_order: 1,
        created_at: 0
      },
      {
        id: "__users_client",
        code: "users_client",
        label: "Clients",
        path: "/users/client",
        icon: "fa-solid fa-building",
        submenus: [],
        sort_order: 2,
        created_at: 0
      },
      {
        id: "__users_talent",
        code: "users_talent",
        label: "Talent",
        path: "/users/talent",
        icon: "fa-solid fa-user-group",
        submenus: [],
        sort_order: 3,
        created_at: 0
      },
      {
        id: "__users_tenant",
        code: "users_tenant",
        label: "Tenant",
        path: "/users/tenant",
        icon: "fa-solid fa-city",
        submenus: [],
        sort_order: 4,
        created_at: 0
      }
    ],
    sort_order: 25,
    created_at: 0
  });

  pushIfMissing(grouped, "config", {
    id: "__profile",
    code: "profile",
    label: "Profile",
    path: "/profile",
    icon: "fa-solid fa-user",
    submenus: [
      {
        id: "__profile_security",
        code: "profile_security",
        label: "Security",
        path: "/profile/security",
        icon: "fa-solid fa-shield-halved",
        submenus: [],
        sort_order: 1,
        created_at: 0
      }
    ],
    sort_order: 30,
    created_at: 0
  });

  pushIfMissing(grouped, "integrations", {
    id: "__blogspot",
    code: "blogspot",
    label: "Blogspot CMS",
    path: "/integrations/blogspot",
    icon: "fa-brands fa-blogger",
    submenus: [
      {
        id: "__blogspot_settings",
        code: "cfg_blogspot",
        label: "API Settings",
        path: "/integrations/blogspot/settings",
        icon: "fa-solid fa-key",
        submenus: [],
        sort_order: 1,
        created_at: 0
      },
      {
        id: "__blogspot_posts",
        code: "blogspot_posts",
        label: "Manage Posts",
        path: "/integrations/blogspot/posts",
        icon: "fa-solid fa-pen",
        submenus: [],
        sort_order: 2,
        created_at: 0
      },
      {
        id: "__blogspot_pages",
        code: "blogspot_pages",
        label: "Static Pages",
        path: "/integrations/blogspot/pages",
        icon: "fa-solid fa-file-lines",
        submenus: [],
        sort_order: 3,
        created_at: 0
      },
      {
        id: "__blogspot_widgets",
        code: "blogspot_widgets",
        label: "Widgets / Home",
        path: "/integrations/blogspot/widgets",
        icon: "fa-solid fa-table-cells-large",
        submenus: [],
        sort_order: 4,
        created_at: 0
      }
    ],
    sort_order: 40,
    created_at: 0
  });

  pushIfMissing(grouped, "integrations", {
    id: "__plugins",
    code: "plugins",
    label: "Plugins",
    path: "/plugins",
    icon: "fa-solid fa-puzzle-piece",
    submenus: [],
    sort_order: 50,
    created_at: 0
  });

  for(const k of Object.keys(grouped)){
    grouped[k] = dedupeByPath(grouped[k]).sort(sortMenus);
  }

  return grouped;
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
  const tree = buildTree(rows);

  const grouped = {
    core: [],
    integrations: [],
    system: [],
    config: []
  };

  for(const item of tree){
    const bucket = bucketOf(item.path);
    grouped[bucket].push(item);
  }

  const finalMenus = forceImportantMenus(grouped);

  return json(200, "ok", {
    menus: {
      core: finalMenus.core,
      integrations: finalMenus.integrations,
      system: finalMenus.system,
      config: finalMenus.config
    }
  });
}

import { json, requireAuth, hasRole } from "../_lib.js";

const GROUP_ORDER = [
  "dashboard",
  "access",
  "users",
  "security",
  "content",
  "ops",
  "data",
  "settings",
  "audit"
];

const ALLOWED_GROUP_KEYS = new Set(GROUP_ORDER);

function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return ALLOWED_GROUP_KEYS.has(x) ? x : "settings";
}

function inferModuleFromPath(path){
  const p = String(path || "").trim();
  if(!p) return "";
  if(p === "/dashboard") return "/modules/mod_dashboard.js";
  if(p === "/roles") return "/modules/mod_role_builder.js";
  if(p === "/menus") return "/modules/mod_menu_builder.js";
  if(p === "/rbac") return "/modules/_core/mod_rbac.js";
  if(p === "/integrations/blogspot/posts") return "/modules/mod_blogspot_posts.js";
  if(p === "/integrations/blogspot/pages") return "/modules/mod_blogspot_pages.js";
  return "";
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const rows = await env.DB.prepare(`
    SELECT
      m.id,
      m.code,
      m.label,
      m.path,
      m.parent_id,
      m.sort_order,
      m.icon,
      m.group_key
    FROM menus m
    ORDER BY
      CASE COALESCE(NULLIF(TRIM(LOWER(m.group_key)), ''), 'settings')
        WHEN 'dashboard' THEN 1
        WHEN 'access' THEN 2
        WHEN 'users' THEN 3
        WHEN 'security' THEN 4
        WHEN 'content' THEN 5
        WHEN 'ops' THEN 6
        WHEN 'data' THEN 7
        WHEN 'settings' THEN 8
        WHEN 'audit' THEN 9
        ELSE 99
      END,
      m.sort_order ASC,
      m.created_at ASC
  `).all();

  const items = (rows.results || []).map(row => ({
    id: String(row.id || ""),
    code: String(row.code || ""),
    label: String(row.label || ""),
    path: String(row.path || "/"),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    sort_order: Number(row.sort_order ?? 9999),
    icon: String(row.icon || ""),
    group_key: normalizeGroupKey(row.group_key)
  }));

  const groups = GROUP_ORDER.map(key => ({
    group_key: key,
    count: items.filter(x => x.group_key === key).length
  }));

  const routes = {};
  for(const item of items){
    const modulePath = inferModuleFromPath(item.path);
    if(modulePath){
      routes[item.path] = { module: modulePath };
    }
  }

  return json(200, "ok", {
    routes,
    items,
    groups
  });
}

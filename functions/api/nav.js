import { json, requireAuth, hasRole } from "../_lib.js";

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/, "");
  return p || "/";
}

function sortMenus(a, b){
  const sa = Number(a.sort_order ?? 9999);
  const sb = Number(b.sort_order ?? 9999);
  if(sa !== sb) return sa - sb;
  return Number(a.created_at ?? 0) - Number(b.created_at ?? 0);
}

function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return [
    "dashboard","access","users","security",
    "content","ops","data","settings","audit"
  ].includes(x) ? x : "settings";
}

function bucketOf(path, groupKey){
  const g = normalizeGroupKey(groupKey);
  if(["dashboard", "access", "users"].includes(g)) return "core";
  if(["content"].includes(g)) return "integrations";
  if(["security", "ops", "data", "audit"].includes(g)) return "system";
  return "config";
}

async function getMenusForRoles(env, roles){
  if(hasRole(roles, ["super_admin"])){
    const r = await env.DB.prepare(`
      SELECT id, code, label, path, parent_id, sort_order, icon, created_at, group_key
      FROM menus
      ORDER BY sort_order ASC, created_at ASC
    `).all();
    return r.results || [];
  }

  const cleanRoles = (roles || []).map(String).filter(Boolean);
  if(!cleanRoles.length) return [];

  const ph = cleanRoles.map(() => "?").join(",");
  const r = await env.DB.prepare(`
    WITH allowed AS (
      SELECT DISTINCT
        m.id, m.code, m.label, m.path, m.parent_id, m.sort_order, m.icon, m.created_at, m.group_key
      FROM role_menus rm
      JOIN roles ro ON ro.id = rm.role_id
      JOIN menus m ON m.id = rm.menu_id
      WHERE ro.name IN (${ph})
    ),
    tree AS (
      SELECT * FROM allowed
      UNION
      SELECT
        p.id, p.code, p.label, p.path, p.parent_id, p.sort_order, p.icon, p.created_at, p.group_key
      FROM menus p
      JOIN tree t ON t.parent_id = p.id
    )
    SELECT DISTINCT
      id, code, label, path, parent_id, sort_order, icon, created_at, group_key
    FROM tree
    ORDER BY sort_order ASC, created_at ASC
  `).bind(...cleanRoles).all();

  return r.results || [];
}

function buildTree(rows){
  const byId = new Map();

  for(const row of rows){
    byId.set(String(row.id), {
      id: String(row.id),
      code: String(row.code || ""),
      label: String(row.label || row.code || row.path || "Menu"),
      path: normPath(row.path || "/"),
      icon: String(row.icon || "fa-solid fa-circle-dot"),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      sort_order: Number(row.sort_order ?? 9999),
      created_at: Number(row.created_at ?? 0),
      group_key: normalizeGroupKey(row.group_key),
      submenus: []
    });
  }

  const roots = [];

  for(const item of byId.values()){
    if(item.parent_id && byId.has(item.parent_id)){
      byId.get(item.parent_id).submenus.push(item);
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

function pruneEmptyParents(items){
  const out = [];

  for(const item of items || []){
    const next = { ...item };
    next.submenus = pruneEmptyParents(next.submenus || []);

    const hasOwnPath = !!(next.path && next.path !== "/");
    const hasChildren = next.submenus.length > 0;

    if(hasOwnPath || hasChildren){
      out.push(next);
    }
  }

  return out;
}

function groupLegacyMenus(tree){
  const grouped = {
    core: [],
    integrations: [],
    system: [],
    config: []
  };

  for(const item of tree){
    const bucket = bucketOf(item.path, item.group_key);
    grouped[bucket].push(item);
  }

  for(const k of Object.keys(grouped)){
    grouped[k].sort(sortMenus);
  }

  return grouped;
}

function flattenItems(rows){
  return (rows || []).map(row => ({
    id: String(row.id),
    code: String(row.code || ""),
    label: String(row.label || row.code || row.path || "Menu"),
    path: normPath(row.path || "/"),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    sort_order: Number(row.sort_order ?? 9999),
    icon: String(row.icon || "fa-solid fa-circle-dot"),
    created_at: Number(row.created_at ?? 0),
    group_key: normalizeGroupKey(row.group_key)
  }));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, [
    "super_admin",
    "admin",
    "staff",
    "security_admin",
    "audit_admin",
    "access_admin",
    "ops_admin"
  ])){
    return json(403, "forbidden", null);
  }

  const rows = await getMenusForRoles(env, a.roles || []);
  const items = flattenItems(rows);
  const tree = pruneEmptyParents(buildTree(rows));
  const grouped = groupLegacyMenus(tree);

  return json(200, "ok", {
    items,
    menus: grouped
  });
}

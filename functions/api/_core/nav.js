import { json, requireAuth, hasRole } from "../../_lib.js";

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/,"");
  return p || "/";
}

function sortMenus(a, b){
  const sa = Number(a.sort_order ?? 9999);
  const sb = Number(b.sort_order ?? 9999);
  if(sa !== sb) return sa - sb;
  return Number(a.created_at ?? 0) - Number(b.created_at ?? 0);
}

function bucketOf(path){
  const p = normPath(path);

  if (p.startsWith("/integrations") || p.startsWith("/plugins")) return "integrations";

  if (
    p.startsWith("/ops") ||
    p.startsWith("/security") ||
    p.startsWith("/audit") ||
    p.startsWith("/data")
  ) return "system";

  if (
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

async function getMenusForRoles(env, roles){
  if(hasRole(roles, ["super_admin"])){
    const r = await env.DB.prepare(`
      SELECT id, code, label, path, parent_id, sort_order, icon, created_at
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
      SELECT DISTINCT m.id, m.code, m.label, m.path, m.parent_id, m.sort_order, m.icon, m.created_at
      FROM role_menus rm
      JOIN roles r ON r.id = rm.role_id
      JOIN menus m ON m.id = rm.menu_id
      WHERE r.name IN (${ph})
    ),
    tree AS (
      SELECT * FROM allowed
      UNION
      SELECT p.id, p.code, p.label, p.path, p.parent_id, p.sort_order, p.icon, p.created_at
      FROM menus p
      JOIN tree t ON t.parent_id = p.id
    )
    SELECT DISTINCT id, code, label, path, parent_id, sort_order, icon, created_at
    FROM tree
    ORDER BY sort_order ASC, created_at ASC
  `).bind(...cleanRoles).all();

  return r.results || [];
}

function buildTree(rows){
  const byId = new Map();

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

  const roots = [];

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

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin","staff"])){
    return json(403, "forbidden", null);
  }

  const rows = await getMenusForRoles(env, a.roles || []);
  const tree = pruneEmptyParents(buildTree(rows));

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

  for(const k of Object.keys(grouped)){
    grouped[k].sort(sortMenus);
  }

  return json(200, "ok", {
    menus: grouped
  });
}

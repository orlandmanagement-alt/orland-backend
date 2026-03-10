import { json, requireAuth, hasRole } from "../_lib.js";

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/,"");
  return p || "/";
}

function sortMenus(a, b){
  const sa = Number(a.sort_order ?? 999999);
  const sb = Number(b.sort_order ?? 999999);
  if(sa !== sb) return sa - sb;

  const ca = Number(a.created_at ?? 0);
  const cb = Number(b.created_at ?? 0);
  if(ca !== cb) return ca - cb;

  return String(a.label || "").localeCompare(String(b.label || ""));
}

function bucketOf(item){
  const code = String(item?.code || "").trim().toLowerCase();
  const path = normPath(item?.path || "/");

  if(code.startsWith("cfg_blogspot") || path.startsWith("/integrations")){
    return "integrations";
  }

  if(
    code.startsWith("security") ||
    code.startsWith("ops") ||
    code.startsWith("audit") ||
    code.startsWith("data") ||
    path.startsWith("/security") ||
    path.startsWith("/ops") ||
    path.startsWith("/audit") ||
    path.startsWith("/data")
  ){
    return "system";
  }

  if(
    code.startsWith("config") ||
    code.startsWith("menu_builder") ||
    code.startsWith("menus") ||
    code.startsWith("rbac") ||
    code.startsWith("ipblocks") ||
    code.startsWith("plugins") ||
    path.startsWith("/config") ||
    path.startsWith("/menu-builder") ||
    path.startsWith("/menus") ||
    path.startsWith("/rbac") ||
    path.startsWith("/ipblocks")
  ){
    return "config";
  }

  return "core";
}

async function getAllMenus(env){
  const r = await env.DB.prepare(`
    SELECT id, code, label, path, parent_id, sort_order, icon, created_at
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
      sort_order: Number(row.sort_order ?? 999999),
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
    const bucket = bucketOf(item);
    grouped[bucket].push(item);
  }

  for(const k of Object.keys(grouped)){
    grouped[k].sort(sortMenus);
  }

  return json(200, "ok", {
    menus: grouped
  });
}

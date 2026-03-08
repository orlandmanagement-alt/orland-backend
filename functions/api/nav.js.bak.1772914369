import { json, requireAuth, hasRole } from "../_lib.js";

function sortMenus(a, b){
  const sa = Number(a.sort_order ?? 9999);
  const sb = Number(b.sort_order ?? 9999);
  if (sa !== sb) return sa - sb;
  const ca = Number(a.created_at ?? 0);
  const cb = Number(b.created_at ?? 0);
  return ca - cb;
}

// IMPORTANT: keep DB id for tree relations (parent_id points to DB id)
function toNode(m){
  return {
    db_id: String(m.id),                 // REAL menus.id (for tree)
    code: String(m.code || ""),          // for Alpine navigate key
    label: String(m.label || m.code || "Menu"),
    path: String(m.path || "/"),
    icon: m.icon ? String(m.icon) : null,
    sort_order: Number(m.sort_order ?? 9999),
    parent_id: m.parent_id ? String(m.parent_id) : null, // points to db_id
    created_at: Number(m.created_at ?? 0),
    children: []
  };
}

function inferSection(path){
  const p = String(path || "");

  if (p.startsWith("/integrations/")) return "integrations";
  if (p.startsWith("/ops")) return "system";
  if (p.startsWith("/security")) return "system";
  if (p.startsWith("/audit")) return "system";
  if (p.startsWith("/data")) return "system";

  // "config" section:
  if (p.startsWith("/config")) return "config";
  if (p.startsWith("/ipblocks")) return "config";
  if (p.startsWith("/menus")) return "config";
  if (p.startsWith("/profile")) return "config";

  return "core";
}

function buildTree(flat){
  const byId = new Map();
  const roots = [];

  for (const n of flat) byId.set(n.db_id, n);

  for (const n of flat){
    if (n.parent_id && byId.has(n.parent_id)){
      byId.get(n.parent_id).children.push(n);
    } else {
      roots.push(n);
    }
  }

  const walkSort = (arr)=>{
    arr.sort(sortMenus);
    for (const x of arr) walkSort(x.children);
  };
  walkSort(roots);

  return roots;
}

// Convert D1 nodes -> Alpine menu shape
function toAlpineMenus(tree){
  const out = { core: [], integrations: [], system: [], config: [] };

  function nodeToMenu(node){
    const item = {
      id: node.code || node.db_id,                 // Alpine expects string id
      label: node.label,
      icon: node.icon || "fa-solid fa-circle-dot",
      path: node.path || "/",
    };

    if (node.children && node.children.length){
      item.submenus = node.children.map(ch => ({
        id: ch.code || ch.db_id,
        label: ch.label,
        icon: ch.icon || null,
        path: ch.path || "/",
      }));
    }
    return item;
  }

  for (const n of tree){
    const sec = inferSection(n.path);
    out[sec].push(nodeToMenu(n));
  }

  return out;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;

  const roles = Array.isArray(a.roles) ? a.roles.map(String) : [];

  let rows = [];
  if (hasRole(roles, ["super_admin"])) {
    const r = await env.DB.prepare(`
      SELECT id,code,label,path,parent_id,sort_order,icon,created_at
      FROM menus
      ORDER BY sort_order ASC, created_at ASC
    `).all();
    rows = r.results || [];
  } else {
    if (!roles.length) {
      return json(200, "ok", { menus:{core:[],integrations:[],system:[],config:[]}, tree:[], flat:[], roles });
    }

    const ph = roles.map(()=>"?").join(",");
    const r = await env.DB.prepare(`
      SELECT DISTINCT m.id,m.code,m.label,m.path,m.parent_id,m.sort_order,m.icon,m.created_at
      FROM role_menus rm
      JOIN roles ro ON ro.id=rm.role_id
      JOIN menus m ON m.id=rm.menu_id
      WHERE ro.name IN (${ph})
      ORDER BY m.sort_order ASC, m.created_at ASC
    `).bind(...roles).all();
    rows = r.results || [];
  }

  // picked map by db id
  const picked = new Map();
  for (const r of rows) picked.set(String(r.id), r);

  // backfill parents (by db id)
  for (let loop = 0; loop < 8; loop++){
    const needParents = [];
    for (const m of picked.values()){
      if (m.parent_id && !picked.has(String(m.parent_id))){
        needParents.push(String(m.parent_id));
      }
    }
    const uniq = Array.from(new Set(needParents));
    if (!uniq.length) break;

    const ph = uniq.map(()=>"?").join(",");
    const pr = await env.DB.prepare(`
      SELECT id,code,label,path,parent_id,sort_order,icon,created_at
      FROM menus
      WHERE id IN (${ph})
    `).bind(...uniq).all();

    for (const p of (pr.results || [])){
      picked.set(String(p.id), p);
    }
  }

  const flat = Array.from(picked.values()).map(toNode);
  const tree = buildTree(flat);
  const menus = toAlpineMenus(tree);

  return json(200, "ok", { menus, tree, flat, roles });
}
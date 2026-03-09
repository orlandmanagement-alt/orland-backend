import { json, requireAuth, hasRole } from "../_lib.js";

function sortMenus(a, b){
  const sa = Number(a.sort_order ?? 9999);
  const sb = Number(b.sort_order ?? 9999);
  if (sa !== sb) return sa - sb;
  const ca = Number(a.created_at ?? 0);
  const cb = Number(b.created_at ?? 0);
  return ca - cb;
}

function toItem(m){
  return {
    id: String(m.code || m.id),
    code: String(m.code || ""),
    label: String(m.label || m.code || "Menu"),
    path: String(m.path || "/"),
    icon: m.icon ? String(m.icon) : null,
    sort_order: Number(m.sort_order ?? 9999),
    parent_id: m.parent_id ? String(m.parent_id) : null,
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
  if (p.startsWith("/config")) return "config";
  if (p.startsWith("/ipblocks")) return "config";
  if (p.startsWith("/menus")) return "config";
  if (p.startsWith("/profile")) return "config";
  return "core";
}

function buildTree(flat){
  const byId = new Map();
  const roots = [];
  for (const m of flat) byId.set(String(m.id), m);

  for (const m of flat){
    if (m.parent_id && byId.has(String(m.parent_id))){
      byId.get(String(m.parent_id)).children.push(m);
    } else roots.push(m);
  }

  const walkSort = (arr)=>{
    arr.sort(sortMenus);
    for (const x of arr) walkSort(x.children);
  };
  walkSort(roots);
  return roots;
}

function toAlpineMenus(tree){
  const out = { core: [], integrations: [], system: [], config: [] };

  function addToSection(section, node){
    const item = {
      id: node.code || node.id,
      label: node.label,
      icon: node.icon || "fa-solid fa-circle-dot",
      path: node.path || "/",
    };
    if (node.children && node.children.length){
      item.submenus = node.children.map(ch => ({
        id: ch.code || ch.id,
        label: ch.label,
        icon: ch.icon || null,
        path: ch.path || "/",
      }));
    }
    out[section].push(item);
  }

  for (const n of tree){
    const sec = inferSection(n.path);
    addToSection(sec, n);
  }
  return out;
}

// ====== NEW: dedupe by path, prefer newest created_at, keep smallest sort_order
function dedupeByPath(rows){
  const map = new Map(); // path -> row
  for(const r of (rows||[])){
    const p = String(r.path||"").trim();
    if(!p) continue;
    const cur = map.get(p);
    if(!cur){
      map.set(p, r);
      continue;
    }
    const curSO = Number(cur.sort_order ?? 9999);
    const rSO   = Number(r.sort_order ?? 9999);
    const curCA = Number(cur.created_at ?? 0);
    const rCA   = Number(r.created_at ?? 0);

    // prefer lower sort_order; if tie prefer newer created_at
    const better = (rSO < curSO) || (rSO === curSO && rCA > curCA);
    if(better) map.set(p, r);
  }
  return Array.from(map.values());
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
    if (!roles.length) return json(200, "ok", { menus: { core:[], integrations:[], system:[], config:[] }, tree: [], flat: [] });

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

  // dedupe by path FIRST (stops double menu)
  rows = dedupeByPath(rows);

  // backfill parents for any picked rows
  const picked = new Map();
  for (const r of rows) picked.set(String(r.id), r);

  let loop = 0;
  while (loop < 8){
    loop++;
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

  const flat = Array.from(picked.values()).map(toItem);
  const tree = buildTree(flat);
  const menus = toAlpineMenus(tree);

  return json(200, "ok", { menus, tree, flat, roles });
}

import { json, requireAuth, menusHasIcon } from "../_lib.js";

// Categorize codes into sidebar groups (simple & stable)
function sectionKeyFor(code){
  const c = String(code||"").toLowerCase();
  if (c.startsWith("blog") || c.includes("cms")) return "integrations";
  if (c.includes("security") || c.includes("audit") || c.includes("ops") || c.includes("config") || c.includes("data") || c.includes("ip")) return "system";
  return "core";
}

function buildTree(rows){
  const map = new Map();
  const roots = [];

  for (const r of rows){
    map.set(r.id, { ...r, children: [] });
  }

  for (const r of rows){
    const node = map.get(r.id);
    const pid = r.parent_id || null;
    if (pid && map.has(pid)) map.get(pid).children.push(node);
    else roots.push(node);
  }

  const sortRec = (arr)=>{
    arr.sort((a,b)=>{
      const sa = Number(a.sort_order||0), sb = Number(b.sort_order||0);
      if (sa !== sb) return sa - sb;
      return Number(a.created_at||0) - Number(b.created_at||0);
    });
    for (const x of arr) sortRec(x.children||[]);
  };
  sortRec(roots);

  return roots;
}

function cloneWithoutChildren(node){
  return {
    id: node.id,
    code: node.code,
    label: node.label,
    path: node.path,
    icon: node.icon || null,
    children: (node.children||[]).map(cloneWithoutChildren),
  };
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  // Find role IDs for current user roles
  const roles = (a.roles || []).map(String);
  if (!roles.length) return json(200,"ok",{ tree:[], sections:{ core:[], integrations:[], system:[] } });

  const ph = roles.map(()=>"?").join(",");
  const roleRows = await env.DB.prepare(`SELECT id,name FROM roles WHERE name IN (${ph})`).bind(...roles).all();
  const roleIds = (roleRows.results||[]).map(x=>x.id);

  const hasIcon = await menusHasIcon(env);

  let menus = [];
  if (roleIds.length){
    const ph2 = roleIds.map(()=>"?").join(",");
    const sql = hasIcon
      ? `SELECT DISTINCT m.id,m.code,m.label,m.path,m.parent_id,m.sort_order,m.created_at,m.icon
         FROM menus m
         JOIN role_menus rm ON rm.menu_id=m.id
         WHERE rm.role_id IN (${ph2})
         ORDER BY m.sort_order ASC, m.created_at ASC`
      : `SELECT DISTINCT m.id,m.code,m.label,m.path,m.parent_id,m.sort_order,m.created_at, NULL AS icon
         FROM menus m
         JOIN role_menus rm ON rm.menu_id=m.id
         WHERE rm.role_id IN (${ph2})
         ORDER BY m.sort_order ASC, m.created_at ASC`;

    const r = await env.DB.prepare(sql).bind(...roleIds).all();
    menus = (r.results||[]);
  }

  // Fallback: if super_admin but role_menus empty, allow all menus
  if ((!menus || menus.length===0) && roles.includes("super_admin")){
    const sqlAll = hasIcon
      ? `SELECT id,code,label,path,parent_id,sort_order,created_at,icon FROM menus ORDER BY sort_order ASC, created_at ASC`
      : `SELECT id,code,label,path,parent_id,sort_order,created_at, NULL AS icon FROM menus ORDER BY sort_order ASC, created_at ASC`;
    const r2 = await env.DB.prepare(sqlAll).all();
    menus = (r2.results||[]);
  }

  const tree = buildTree(menus).map(cloneWithoutChildren);

  // Build sections from top-level nodes
  const sections = { core:[], integrations:[], system:[] };
  for (const top of tree){
    const k = sectionKeyFor(top.code);
    sections[k].push(top);
  }

  return json(200,"ok",{ tree, sections });
}

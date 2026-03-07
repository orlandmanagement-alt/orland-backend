import { json, requireAuth } from "../_lib.js";

function groupKey(m){
  const id = String(m.id || "");
  if (id.startsWith("m_core_") || id.startsWith("m_users_")) return "core";
  if (id.startsWith("m_int_") || id.startsWith("m_blog_")) return "integrations";
  if (id.startsWith("m_sys_") || id.startsWith("m_ops_") || id.startsWith("m_data_") || id.startsWith("m_cfg_")) return "system";
  if (id.startsWith("m_profile")) return "system";
  const so = Number(m.sort_order || 50);
  if (so < 60) return "core";
  if (so < 70) return "integrations";
  return "system";
}

function buildTree(rows){
  const byId = new Map();
  const roots = [];
  for (const r of rows){
    const node = {
      id: r.id,
      code: r.code,
      label: r.label,
      path: r.path,
      parent_id: r.parent_id,
      sort_order: Number(r.sort_order || 50),
      icon: r.icon || null,
      group: groupKey(r),
      children: [],
    };
    byId.set(node.id, node);
  }
  for (const n of byId.values()){
    if (n.parent_id && byId.has(n.parent_id)){
      byId.get(n.parent_id).children.push(n);
    } else {
      roots.push(n);
    }
  }
  const sortRec = (arr)=>{
    arr.sort((a,b)=> (a.sort_order-b.sort_order) || String(a.label).localeCompare(String(b.label)));
    for (const x of arr) sortRec(x.children);
  };
  sortRec(roots);
  return roots;
}

export async function onRequestGet({ request, env }) {
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;

  const roles = (a.roles || []).map(String);
  if (!roles.length) return json(200, "ok", { tree: [], grouped: { core:[], integrations:[], system:[] }, roles: [] });

  const sql = `
    SELECT DISTINCT
      m.id, m.code, m.label, m.path, m.parent_id, m.sort_order,
      COALESCE(m.icon, NULL) AS icon,
      m.created_at
    FROM menus m
    JOIN role_menus rm ON rm.menu_id = m.id
    JOIN roles r ON r.id = rm.role_id
    WHERE r.name IN (${roles.map(()=>"?").join(",")})
    ORDER BY m.sort_order ASC, m.created_at ASC
  `;
  const q = await env.DB.prepare(sql).bind(...roles).all();
  const rows = q.results || [];
  const tree = buildTree(rows);

  const grouped = { core: [], integrations: [], system: [] };
  for (const n of tree){
    const g = n.group || "core";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(n);
  }

  return json(200, "ok", { tree, grouped, roles });
}

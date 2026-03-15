import { json, requireAuth } from "../_lib.js";

function safeStr(v){
  return String(v ?? "").trim();
}

function sortNum(v, defv = 9999){
  const n = Number(v);
  return Number.isFinite(n) ? n : defv;
}

function buildTree(rows){
  const byId = new Map();
  const roots = [];

  for(const row of rows){
    byId.set(row.id, {
      id: row.id,
      code: row.code,
      label: row.label,
      path: row.path,
      parent_id: row.parent_id,
      sort_order: sortNum(row.sort_order),
      icon: row.icon || "",
      group_key: row.group_key || "",
      children: []
    });
  }

  for(const row of rows){
    const node = byId.get(row.id);
    const pid = safeStr(row.parent_id);
    if(pid && byId.has(pid)){
      byId.get(pid).children.push(node);
    } else {
      roots.push(node);
    }
  }

  function deepSort(items){
    items.sort((a, b) => {
      if(a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return safeStr(a.label).localeCompare(safeStr(b.label));
    });
    for(const item of items) deepSort(item.children);
    return items;
  }

  return deepSort(roots);
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  const roleNames = Array.isArray(auth.roles) ? auth.roles.map(String) : [];
  if(!roleNames.length){
    return json(200, "ok", { items: [] });
  }

  const placeholders = roleNames.map(() => "?").join(",");
  const sql = `
    SELECT DISTINCT
      m.id,
      m.code,
      m.label,
      m.path,
      m.parent_id,
      m.sort_order,
      m.icon,
      m.group_key
    FROM menus m
    JOIN role_menus rm ON rm.menu_id = m.id
    JOIN roles r ON r.id = rm.role_id
    WHERE r.name IN (${placeholders})
    ORDER BY m.sort_order ASC, m.created_at ASC, m.label ASC
  `;

  const res = await env.DB.prepare(sql).bind(...roleNames).all();
  const rows = res.results || [];
  const items = buildTree(rows);

  return json(200, "ok", {
    roles: roleNames,
    count: rows.length,
    items
  });
}

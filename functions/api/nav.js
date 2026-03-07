import { json, requireAuth } from "../_lib.js";

function groupFromCode(code){
  const c = String(code||"").toLowerCase();
  // kamu bisa ubah mapping ini kapan saja tanpa ubah DB
  if (["dashboard","users","projects","rbac"].includes(c)) return "core";
  if (["blogspot"].includes(c)) return "integrations";
  return "system";
}

function buildTree(rows){
  const map = new Map();
  rows.forEach(r=>map.set(r.id,{...r, children:[]}));
  const roots=[];
  rows.forEach(r=>{
    const n=map.get(r.id);
    if(r.parent_id && map.has(r.parent_id)) map.get(r.parent_id).children.push(n);
    else roots.push(n);
  });
  const sortFn=(a,b)=>(a.sort_order-b.sort_order)||((a.created_at||0)-(b.created_at||0));
  const walk=(n)=>{ n.children.sort(sortFn); n.children.forEach(walk); };
  roots.sort(sortFn); roots.forEach(walk);
  return roots;
}

function treeToAlpineMenus(tree){
  // Convert DB tree => { core:[], integrations:[], system:[] } with optional submenus
  const grouped={ core:[], integrations:[], system:[] };

  for(const m of tree){
    const g = groupFromCode(m.code);
    const item = {
      id: String(m.code||m.id),
      label: m.label,
      icon: m.icon || "fa-solid fa-circle",
      path: m.path || null,
    };

    if(m.children && m.children.length){
      item.submenus = m.children.map(ch=>({
        id: String(ch.code||ch.id),
        label: ch.label,
        path: ch.path || null,
      }));
    }
    grouped[g].push(item);
  }

  return grouped;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  // menu sesuai role (kalau role_menus ada)
  const hasRM = await env.DB.prepare("SELECT 1 AS ok FROM role_menus LIMIT 1").first();

  let rows=[];
  if(hasRM){
    const ph = (a.roles||[]).map(()=>"?").join(",");
    const q = await env.DB.prepare(`
      SELECT m.id,m.code,m.label,m.path,m.parent_id,m.sort_order,m.created_at,COALESCE(m.icon,'') AS icon
      FROM menus m
      JOIN role_menus rm ON rm.menu_id=m.id
      JOIN roles r ON r.id=rm.role_id
      WHERE r.name IN (${ph})
      GROUP BY m.id
      ORDER BY m.sort_order ASC, m.created_at ASC
    `).bind(...(a.roles||[])).all();
    rows = q.results || [];
  }else{
    const q = await env.DB.prepare(`
      SELECT id,code,label,path,parent_id,sort_order,created_at,COALESCE(icon,'') AS icon
      FROM menus
      ORDER BY sort_order ASC, created_at ASC
    `).all();
    rows = q.results || [];
  }

  const tree = buildTree(rows);
  const grouped = treeToAlpineMenus(tree);

  // return 2 format: grouped (untuk Alpine), tree (untuk debug)
  return json(200,"ok",{ grouped, tree });
}

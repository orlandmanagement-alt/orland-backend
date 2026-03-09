import { json, requireAuth, hasRole } from "../_lib.js";

function bucketOf(path){
  const p = String(path || "");

  if (p.startsWith("/integrations/")) return "integrations";
  if (p.startsWith("/ops") || p.startsWith("/security") || p.startsWith("/audit") || p.startsWith("/data")) return "system";
  if (p.startsWith("/config") || p.startsWith("/ipblocks") || p.startsWith("/menus") || p.startsWith("/profile") || p.startsWith("/rbac")) return "config";
  return "core";
}

function sortMenus(a,b){
  const sa = Number(a.sort_order ?? 9999);
  const sb = Number(b.sort_order ?? 9999);
  if(sa!==sb) return sa-sb;
  return Number(a.created_at ?? 0) - Number(b.created_at ?? 0);
}

function buildBucket(menus){
  const byId = new Map();
  const roots = [];
  for(const m of menus) byId.set(String(m.id), { ...m, submenus: [] });

  for(const m of byId.values()){
    if(m.parent_id && byId.has(String(m.parent_id))){
      byId.get(String(m.parent_id)).submenus.push(m);
    }else{
      roots.push(m);
    }
  }

  const walk = (arr)=>{
    arr.sort(sortMenus);
    for(const x of arr) walk(x.submenus || []);
  };
  walk(roots);
  return roots;
}

async function getAllowedMenus(env, roles){
  if (hasRole(roles, ["super_admin"])) {
    const r = await env.DB.prepare(`
      SELECT id,code,label,path,parent_id,sort_order,icon,created_at
      FROM menus
      ORDER BY sort_order ASC, created_at ASC
    `).all();
    return r.results || [];
  }

  if (!roles.length) return [];

  const ph = roles.map(()=>"?").join(",");
  const r = await env.DB.prepare(`
    SELECT DISTINCT m.id,m.code,m.label,m.path,m.parent_id,m.sort_order,m.icon,m.created_at
    FROM role_menus rm
    JOIN roles ro ON ro.id=rm.role_id
    JOIN menus m ON m.id=rm.menu_id
    WHERE ro.name IN (${ph})
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).bind(...roles).all();

  return r.results || [];
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const roles = Array.isArray(a.roles) ? a.roles.map(String) : [];
  if(!hasRole(roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const rows = await getAllowedMenus(env, roles);

  const grouped = {
    core: [],
    integrations: [],
    system: [],
    config: []
  };

  for(const m of rows){
    const b = bucketOf(m.path);
    grouped[b].push(m);
  }

  return json(200,"ok",{
    menus: {
      core: buildBucket(grouped.core),
      integrations: buildBucket(grouped.integrations),
      system: buildBucket(grouped.system),
      config: buildBucket(grouped.config)
    }
  });
}

import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function canManage(a){
  return hasRole(a.roles, ["super_admin","admin"]);
}

function normStr(v){
  return String(v ?? "").trim();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,code,label,path,parent_id,sort_order,icon,created_at
    FROM menus
    ORDER BY sort_order ASC, created_at ASC
  `).all();

  return json(200,"ok",{ menus: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const now = nowSec();

  const id = normStr(body.id) || crypto.randomUUID();
  const code = normStr(body.code);
  const label = normStr(body.label) || code;
  const path = normStr(body.path) || "/";
  const parent_id = normStr(body.parent_id) || null;
  const sort_order = Number(body.sort_order ?? 50);
  const icon = normStr(body.icon) || null;

  if(!code) return json(400,"invalid_input",{ message:"code_required" });
  if(!label) return json(400,"invalid_input",{ message:"label_required" });
  if(!path.startsWith("/")) return json(400,"invalid_input",{ message:"path_must_start_with_slash" });

  // upsert: if exists -> update, else insert
  const exists = await env.DB.prepare(`SELECT 1 AS ok FROM menus WHERE id=? LIMIT 1`).bind(id).first();
  if(exists){
    await env.DB.prepare(`
      UPDATE menus
      SET code=?, label=?, path=?, parent_id=?, sort_order=?, icon=?
      WHERE id=?
    `).bind(code,label,path,parent_id,sort_order,icon,id).run();

    return json(200,"ok",{ updated:true, id });
  }

  await env.DB.prepare(`
    INSERT INTO menus (id,code,label,path,parent_id,sort_order,icon,created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(id,code,label,path,parent_id,sort_order,icon,now).run();

  return json(200,"ok",{ created:true, id });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  // Remove role_menus links first (avoid orphan)
  await env.DB.prepare(`DELETE FROM role_menus WHERE menu_id=?`).bind(id).run();

  // Remove children (simple safety): set parent_id NULL (do not delete children silently)
  await env.DB.prepare(`UPDATE menus SET parent_id=NULL WHERE parent_id=?`).bind(id).run();

  await env.DB.prepare(`DELETE FROM menus WHERE id=?`).bind(id).run();

  return json(200,"ok",{ deleted:true, id });
}

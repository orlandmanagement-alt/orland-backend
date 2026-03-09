import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin"]); }

function cleanPath(p){
  p = String(p||"").trim();
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/,"");
  return p || "/";
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,code,label,path,parent_id,sort_order,icon,created_at
    FROM menus
    ORDER BY sort_order ASC, created_at ASC
  `).all();

  return json(200,"ok",{ menus: r.results||[] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const b = await readJson(request) || {};
  const id = String(b.id||"").trim() || crypto.randomUUID();
  const code = String(b.code||"").trim();
  const label = String(b.label||"").trim();
  const path = cleanPath(b.path||"");
  const parent_id = b.parent_id ? String(b.parent_id).trim() : null;
  const sort_order = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 50;
  const icon = b.icon ? String(b.icon).trim() : null;

  if(!code || !label || !path) return json(400,"invalid_input",{message:"code/label/path_required"});

  const now = nowSec();

  // create if not exists, else update
  const ex = await env.DB.prepare(`SELECT id FROM menus WHERE id=? LIMIT 1`).bind(id).first();
  if(!ex){
    await env.DB.prepare(`
      INSERT INTO menus (id,code,label,path,parent_id,sort_order,icon,created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(id,code,label,path,parent_id,sort_order,icon,now).run();
    return json(200,"ok",{ created:true, id });
  }else{
    await env.DB.prepare(`
      UPDATE menus
      SET code=?, label=?, path=?, parent_id=?, sort_order=?, icon=?
      WHERE id=?
    `).bind(code,label,path,parent_id,sort_order,icon,id).run();
    return json(200,"ok",{ updated:true, id });
  }
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const b = await readJson(request) || {};
  const action = String(b.action||"update").trim();
  const id = String(b.id||b.menu_id||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  if(action === "update"){
    const code = String(b.code||"").trim();
    const label = String(b.label||"").trim();
    const path = cleanPath(b.path||"");
    const parent_id = (b.parent_id===null || b.parent_id==="") ? null : (b.parent_id ? String(b.parent_id).trim() : null);
    const sort_order = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 50;
    const icon = b.icon ? String(b.icon).trim() : null;

    if(!code || !label || !path) return json(400,"invalid_input",{message:"code/label/path_required"});

    await env.DB.prepare(`
      UPDATE menus SET code=?, label=?, path=?, parent_id=?, sort_order=?, icon=? WHERE id=?
    `).bind(code,label,path,parent_id,sort_order,icon,id).run();

    return json(200,"ok",{ updated:true, id });
  }

  // move up/down inside same parent group by swapping sort_order
  if(action === "move"){
    const dir = String(b.dir||"").trim(); // "up" | "down"
    if(dir!=="up" && dir!=="down") return json(400,"invalid_input",{message:"dir_up_or_down"});

    const cur = await env.DB.prepare(`
      SELECT id,parent_id,sort_order,created_at
      FROM menus WHERE id=? LIMIT 1
    `).bind(id).first();
    if(!cur) return json(404,"not_found",null);

    const parent_id = cur.parent_id || null;
    const sort_order = Number(cur.sort_order||50);
    const created_at = Number(cur.created_at||0);

    // find neighbor
    let neighbor = null;
    if(dir==="up"){
      neighbor = await env.DB.prepare(`
        SELECT id,sort_order,created_at
        FROM menus
        WHERE ( (parent_id IS NULL AND ? IS NULL) OR parent_id=? )
          AND (sort_order < ? OR (sort_order=? AND created_at < ?))
        ORDER BY sort_order DESC, created_at DESC
        LIMIT 1
      `).bind(parent_id,parent_id,sort_order,sort_order,created_at).first();
    }else{
      neighbor = await env.DB.prepare(`
        SELECT id,sort_order,created_at
        FROM menus
        WHERE ( (parent_id IS NULL AND ? IS NULL) OR parent_id=? )
          AND (sort_order > ? OR (sort_order=? AND created_at > ?))
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1
      `).bind(parent_id,parent_id,sort_order,sort_order,created_at).first();
    }
    if(!neighbor) return json(200,"ok",{ moved:false, reason:"edge" });

    // swap sort_order
    await env.DB.prepare(`UPDATE menus SET sort_order=? WHERE id=?`).bind(Number(neighbor.sort_order||50), id).run();
    await env.DB.prepare(`UPDATE menus SET sort_order=? WHERE id=?`).bind(sort_order, neighbor.id).run();

    return json(200,"ok",{ moved:true, id, swap_with: neighbor.id });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  // prevent delete if has children
  const ch = await env.DB.prepare(`SELECT 1 AS ok FROM menus WHERE parent_id=? LIMIT 1`).bind(id).first();
  if(ch) return json(409,"conflict",{message:"has_children"});

  await env.DB.prepare(`DELETE FROM menus WHERE id=?`).bind(id).run();
  return json(200,"ok",{ deleted:true, id });
}

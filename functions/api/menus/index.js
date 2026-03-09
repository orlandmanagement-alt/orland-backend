import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function isAdmin(a){ return hasRole(a.roles, ["super_admin","admin"]); }

function normPath(p){
  p = String(p||"").trim();
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\s+/g,"");
  p = p.replace(/\/+$/,"");
  return p || "/";
}

function normCode(s){
  return String(s||"").trim().toLowerCase().replace(/[^a-z0-9_]/g,"_");
}

function clampInt(n, lo, hi, defv){
  n = Number(n);
  if(!Number.isFinite(n)) return defv;
  n = Math.floor(n);
  if(n < lo) return lo;
  if(n > hi) return hi;
  return n;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!isAdmin(a)) return json(403,"forbidden",null);

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
  if(!isAdmin(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id || crypto.randomUUID());
  const code = normCode(body.code);
  const label = String(body.label||"").trim();
  const path = normPath(body.path);
  const parent_id = body.parent_id ? String(body.parent_id) : null;
  const sort_order = clampInt(body.sort_order, 1, 9999, 50);
  const icon = body.icon ? String(body.icon).trim() : null;

  if(!code || code.length < 2) return json(400,"invalid_input",{message:"code"});
  if(!label || label.length < 2) return json(400,"invalid_input",{message:"label"});
  if(!path || !path.startsWith("/")) return json(400,"invalid_input",{message:"path"});

  // prevent duplicate path (common reason sidebar weird)
  const dup = await env.DB.prepare(`SELECT id FROM menus WHERE path=? LIMIT 1`).bind(path).first();
  if(dup) return json(409,"conflict",{message:"path_exists", id: dup.id});

  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO menus (id,code,label,path,parent_id,sort_order,icon,created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(id, code, label, path, parent_id, sort_order, icon, now).run();

  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!isAdmin(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action||"update");

  if(action === "update"){
    const id = String(body.id||"");
    if(!id) return json(400,"invalid_input",{message:"id"});

    const code = body.code != null ? normCode(body.code) : null;
    const label = body.label != null ? String(body.label||"").trim() : null;
    const path = body.path != null ? normPath(body.path) : null;
    const parent_id = body.parent_id === "" ? null : (body.parent_id != null ? String(body.parent_id) : undefined);
    const sort_order = body.sort_order != null ? clampInt(body.sort_order, 1, 9999, 50) : null;
    const icon = body.icon === "" ? null : (body.icon != null ? String(body.icon).trim() : undefined);

    const cur = await env.DB.prepare(`SELECT id,path FROM menus WHERE id=? LIMIT 1`).bind(id).first();
    if(!cur) return json(404,"not_found",null);

    if(path && path !== cur.path){
      const dup = await env.DB.prepare(`SELECT id FROM menus WHERE path=? AND id<>? LIMIT 1`).bind(path, id).first();
      if(dup) return json(409,"conflict",{message:"path_exists", id: dup.id});
    }

    const sets = [];
    const binds = [];
    if(code){ sets.push("code=?"); binds.push(code); }
    if(label){ sets.push("label=?"); binds.push(label); }
    if(path){ sets.push("path=?"); binds.push(path); }
    if(parent_id !== undefined){ sets.push("parent_id=?"); binds.push(parent_id); }
    if(sort_order != null){ sets.push("sort_order=?"); binds.push(sort_order); }
    if(icon !== undefined){ sets.push("icon=?"); binds.push(icon); }

    if(!sets.length) return json(200,"ok",{ updated:false });

    binds.push(id);
    await env.DB.prepare(`UPDATE menus SET ${sets.join(", ")} WHERE id=?`).bind(...binds).run();
    return json(200,"ok",{ updated:true });
  }

  if(action === "reorder"){
    // reorder by swap sort_order
    const id = String(body.id||"");
    const dir = String(body.dir||""); // "up" | "down"
    if(!id || (dir!=="up" && dir!=="down")) return json(400,"invalid_input",{message:"id/dir"});

    const cur = await env.DB.prepare(`SELECT id,sort_order,parent_id FROM menus WHERE id=? LIMIT 1`).bind(id).first();
    if(!cur) return json(404,"not_found",null);

    const parent_id = cur.parent_id ? String(cur.parent_id) : null;

    let neighbor;
    if(dir==="up"){
      neighbor = await env.DB.prepare(`
        SELECT id,sort_order FROM menus
        WHERE (parent_id IS ? OR parent_id = ?) AND sort_order < ?
        ORDER BY sort_order DESC, created_at DESC
        LIMIT 1
      `).bind(parent_id, parent_id, cur.sort_order).first();
    }else{
      neighbor = await env.DB.prepare(`
        SELECT id,sort_order FROM menus
        WHERE (parent_id IS ? OR parent_id = ?) AND sort_order > ?
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1
      `).bind(parent_id, parent_id, cur.sort_order).first();
    }

    if(!neighbor) return json(200,"ok",{ moved:false });

    // swap
    await env.DB.prepare(`UPDATE menus SET sort_order=? WHERE id=?`).bind(neighbor.sort_order, cur.id).run();
    await env.DB.prepare(`UPDATE menus SET sort_order=? WHERE id=?`).bind(cur.sort_order, neighbor.id).run();

    return json(200,"ok",{ moved:true });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!isAdmin(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"");
  if(!id) return json(400,"invalid_input",{message:"id"});

  // prevent deleting parent that has children
  const ch = await env.DB.prepare(`SELECT 1 AS ok FROM menus WHERE parent_id=? LIMIT 1`).bind(id).first();
  if(ch) return json(409,"conflict",{message:"has_children"});

  // also remove role_menus
  await env.DB.prepare(`DELETE FROM role_menus WHERE menu_id=?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM menus WHERE id=?`).bind(id).run();

  return json(200,"ok",{ deleted:true });
}

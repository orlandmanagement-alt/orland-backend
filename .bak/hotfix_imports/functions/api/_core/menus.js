import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function s(v){ return String(v || "").trim(); }
function n(v, d=0){ const x = Number(v); return Number.isFinite(x) ? x : d; }

function normPath(p){
  p = s(p);
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/,"");
  return p || "/";
}

function validCode(v){
  return /^[a-z0-9_]+$/.test(String(v || ""));
}

async function listRoles(env){
  const r = await env.DB.prepare(`
    SELECT id, name
    FROM roles
    ORDER BY name ASC
  `).all();
  return r.results || [];
}

async function getMenu(env, id){
  return await env.DB.prepare(`
    SELECT id, code, label, path, parent_id, sort_order, icon, created_at
    FROM menus
    WHERE id=?
    LIMIT 1
  `).bind(id).first();
}

async function listMenusJoined(env){
  const r = await env.DB.prepare(`
    SELECT
      m.id,
      m.code,
      m.label,
      m.path,
      m.parent_id,
      m.sort_order,
      m.icon,
      m.created_at,
      p.label AS parent_label,
      COALESCE((
        SELECT json_group_array(name)
        FROM (
          SELECT r.name AS name
          FROM role_menus rm
          JOIN roles r ON r.id = rm.role_id
          WHERE rm.menu_id = m.id
          ORDER BY r.name ASC
        )
      ), '[]') AS role_names_json
    FROM menus m
    LEFT JOIN menus p ON p.id = m.parent_id
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).all();

  return (r.results || []).map(x => ({
    ...x,
    role_names_json: (() => {
      try{ return JSON.parse(String(x.role_names_json || "[]")); }
      catch{ return []; }
    })()
  }));
}

async function replaceRoleMenus(env, menuId, roleIds){
  await env.DB.prepare(`
    DELETE FROM role_menus
    WHERE menu_id=?
  `).bind(menuId).run();

  const now = nowSec();
  for(const roleId of roleIds){
    await env.DB.prepare(`
      INSERT INTO role_menus (role_id, menu_id, created_at)
      VALUES (?, ?, ?)
    `).bind(roleId, menuId, now).run();
  }
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const [roles, menus] = await Promise.all([
    listRoles(env),
    listMenusJoined(env)
  ]);

  return json(200, "ok", {
    roles,
    menus
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const action = s(body.action || "create").toLowerCase();

  if(action === "delete"){
    const id = s(body.id);
    if(!id) return json(400, "invalid_input", { message:"id_required" });

    const ex = await getMenu(env, id);
    if(!ex) return json(404, "not_found", { message:"menu_not_found" });

    const child = await env.DB.prepare(`
      SELECT id FROM menus WHERE parent_id=? LIMIT 1
    `).bind(id).first();

    if(child){
      return json(400, "invalid_input", { message:"menu_has_children" });
    }

    await env.DB.prepare(`DELETE FROM role_menus WHERE menu_id=?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM menus WHERE id=?`).bind(id).run();

    return json(200, "ok", { deleted:true, id });
  }

  const mode = action === "update" ? "update" : "create";

  const id = s(body.id);
  const code = s(body.code).toLowerCase();
  const label = s(body.label);
  const path = normPath(body.path || "/");
  const parent_id = s(body.parent_id || "");
  const sort_order = n(body.sort_order, 50);
  const icon = s(body.icon || "fa-solid fa-circle-dot");
  const role_ids = Array.isArray(body.role_ids) ? body.role_ids.map(x => s(x)).filter(Boolean) : [];

  if(!id) return json(400, "invalid_input", { message:"id_required" });
  if(!code) return json(400, "invalid_input", { message:"code_required" });
  if(!validCode(code)) return json(400, "invalid_input", { message:"code_invalid" });
  if(!label) return json(400, "invalid_input", { message:"label_required" });

  if(parent_id){
    if(parent_id === id){
      return json(400, "invalid_input", { message:"parent_invalid_same_id" });
    }
    const p = await getMenu(env, parent_id);
    if(!p){
      return json(400, "invalid_input", { message:"parent_not_found" });
    }
  }

  const sameCode = await env.DB.prepare(`
    SELECT id FROM menus WHERE code=? AND id<>? LIMIT 1
  `).bind(code, id).first();
  if(sameCode){
    return json(400, "invalid_input", { message:"code_exists" });
  }

  const samePath = await env.DB.prepare(`
    SELECT id FROM menus WHERE path=? AND id<>? LIMIT 1
  `).bind(path, id).first();
  if(path !== "/" && samePath){
    return json(400, "invalid_input", { message:"path_exists" });
  }

  if(mode === "create"){
    const ex = await getMenu(env, id);
    if(ex) return json(400, "invalid_input", { message:"id_exists" });

    await env.DB.prepare(`
      INSERT INTO menus (
        id, code, label, path, parent_id, sort_order, icon, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      code,
      label,
      path,
      parent_id || null,
      sort_order,
      icon,
      nowSec()
    ).run();
  }else{
    const ex = await getMenu(env, id);
    if(!ex) return json(404, "not_found", { message:"menu_not_found" });

    await env.DB.prepare(`
      UPDATE menus
      SET code=?, label=?, path=?, parent_id=?, sort_order=?, icon=?
      WHERE id=?
    `).bind(
      code,
      label,
      path,
      parent_id || null,
      sort_order,
      icon,
      id
    ).run();
  }

  await replaceRoleMenus(env, id, role_ids);

  return json(200, "ok", {
    saved: true,
    mode,
    id
  });
}

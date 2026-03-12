import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function safeJsonArray(v){
  if(Array.isArray(v)) return v;
  if(v == null || v === "") return [];
  try{
    const x = JSON.parse(String(v));
    return Array.isArray(x) ? x : [];
  }catch{
    return [];
  }
}

async function hasDescriptionColumn(env){
  try{
    const r = await env.DB.prepare(`PRAGMA table_info(roles)`).all();
    const cols = (r.results || []).map(x => String(x.name || "").toLowerCase());
    return cols.includes("description");
  }catch{
    return false;
  }
}

async function listRoles(env){
  const withDesc = await hasDescriptionColumn(env);

  const sql = withDesc
    ? `
      SELECT
        r.id,
        r.name,
        r.description,
        r.created_at,
        COALESCE((
          SELECT COUNT(*)
          FROM role_menus rm
          WHERE rm.role_id = r.id
        ), 0) AS menu_usage_count,
        COALESCE((
          SELECT json_group_array(
            json_object(
              'id', m.id,
              'code', m.code,
              'label', m.label,
              'path', m.path
            )
          )
          FROM (
            SELECT m.id, m.code, m.label, m.path
            FROM role_menus rm
            JOIN menus m ON m.id = rm.menu_id
            WHERE rm.role_id = r.id
            ORDER BY m.sort_order ASC, m.created_at ASC
          ) m
        ), '[]') AS menu_usage_items_json
      FROM roles r
      ORDER BY r.name ASC, r.created_at ASC
    `
    : `
      SELECT
        r.id,
        r.name,
        '' AS description,
        r.created_at,
        COALESCE((
          SELECT COUNT(*)
          FROM role_menus rm
          WHERE rm.role_id = r.id
        ), 0) AS menu_usage_count,
        COALESCE((
          SELECT json_group_array(
            json_object(
              'id', m.id,
              'code', m.code,
              'label', m.label,
              'path', m.path
            )
          )
          FROM (
            SELECT m.id, m.code, m.label, m.path
            FROM role_menus rm
            JOIN menus m ON m.id = rm.menu_id
            WHERE rm.role_id = r.id
            ORDER BY m.sort_order ASC, m.created_at ASC
          ) m
        ), '[]') AS menu_usage_items_json
      FROM roles r
      ORDER BY r.name ASC, r.created_at ASC
    `;

  const r = await env.DB.prepare(sql).all();

  return (r.results || []).map(x => ({
    id: String(x.id),
    name: String(x.name || ""),
    description: String(x.description || ""),
    created_at: Number(x.created_at ?? 0),
    menu_usage_count: Number(x.menu_usage_count ?? 0),
    menu_usage_items: safeJsonArray(x.menu_usage_items_json).map(m => ({
      id: String(m?.id || ""),
      code: String(m?.code || ""),
      label: String(m?.label || ""),
      path: String(m?.path || "")
    }))
  }));
}

async function getRoleUsageCount(env, id){
  try{
    const r = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM role_menus
      WHERE role_id=?
    `).bind(id).first();

    return Number(r?.total ?? 0);
  }catch{
    return 0;
  }
}

function isProtectedRole(id){
  return ["super_admin", "admin", "staff", "client", "talent"].includes(String(id || ""));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const items = await listRoles(env);
  return json(200, "ok", { items });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const action = String(body.action || "").trim().toLowerCase();
  const id = String(body.id || "").trim();
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const now = nowSec();

  if(!["create", "update", "delete"].includes(action)){
    return json(400, "invalid_input", { message: "invalid_action" });
  }

  if(action === "delete"){
    if(!id){
      return json(400, "invalid_input", { message: "id_required" });
    }

    if(isProtectedRole(id)){
      return json(400, "invalid_input", { message: "protected_role" });
    }

    const usageCount = await getRoleUsageCount(env, id);
    if(usageCount > 0){
      return json(400, "invalid_input", {
        message: "role_in_use_by_menus",
        menu_usage_count: usageCount
      });
    }

    await env.DB.prepare(`DELETE FROM roles WHERE id=?`).bind(id).run();

    return json(200, "ok", {
      deleted: true,
      id
    });
  }

  if(!id || !name){
    return json(400, "invalid_input", { message: "id_name_required" });
  }

  if(!/^[a-zA-Z0-9_\-]+$/.test(id)){
    return json(400, "invalid_input", { message: "id_invalid" });
  }

  const withDesc = await hasDescriptionColumn(env);

  if(action === "create"){
    const exists = await env.DB.prepare(`
      SELECT id
      FROM roles
      WHERE id=? OR lower(name)=lower(?)
      LIMIT 1
    `).bind(id, name).first();

    if(exists){
      return json(400, "invalid_input", { message: "role_id_or_name_exists" });
    }

    if(withDesc){
      await env.DB.prepare(`
        INSERT INTO roles (id, name, description, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(id, name, description, now).run();
    }else{
      await env.DB.prepare(`
        INSERT INTO roles (id, name, created_at)
        VALUES (?, ?, ?)
      `).bind(id, name, now).run();
    }

    return json(200, "ok", { created: true, id });
  }

  const exists = await env.DB.prepare(`
    SELECT id
    FROM roles
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!exists){
    return json(404, "not_found", { message: "role_not_found" });
  }

  const nameConflict = await env.DB.prepare(`
    SELECT id
    FROM roles
    WHERE lower(name)=lower(?) AND id<>?
    LIMIT 1
  `).bind(name, id).first();

  if(nameConflict){
    return json(400, "invalid_input", { message: "role_name_exists" });
  }

  if(withDesc){
    await env.DB.prepare(`
      UPDATE roles
      SET name=?,
          description=?
      WHERE id=?
    `).bind(name, description, id).run();
  }else{
    await env.DB.prepare(`
      UPDATE roles
      SET name=?
      WHERE id=?
    `).bind(name, id).run();
  }

  return json(200, "ok", { updated: true, id });
}

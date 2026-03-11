import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

const ALLOWED_GROUP_KEYS = new Set([
  "dashboard",
  "access",
  "users",
  "security",
  "content",
  "ops",
  "data",
  "settings",
  "audit"
]);

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

function cleanPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/");
  if(p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return ALLOWED_GROUP_KEYS.has(x) ? x : "";
}

async function listRoles(env){
  const r = await env.DB.prepare(`
    SELECT id, name
    FROM roles
    ORDER BY name ASC
  `).all();
  return r.results || [];
}

function buildMenuAudit(row, allRows){
  const flags = [];
  const roleCount = Array.isArray(row.role_ids_json) ? row.role_ids_json.length : 0;
  const path = String(row.path || "");
  const parentId = String(row.parent_id || "");
  const hasParent = !!parentId;
  const parentExists = !hasParent || allRows.some(x => String(x.id) === parentId);
  const duplicatePathCount = allRows.filter(x => String(x.path || "") === path).length;

  if(roleCount === 0) flags.push("no_roles");
  if(hasParent && !parentExists) flags.push("orphan_parent");
  if(path && duplicatePathCount > 1) flags.push("duplicate_path");
  if(roleCount >= 5) flags.push("broad_role_coverage");

  return {
    role_count: roleCount,
    duplicate_path_count: duplicatePathCount,
    flags
  };
}

async function listMenus(env){
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
      m.group_key,
      p.label AS parent_label,
      COALESCE((
        SELECT json_group_array(role_name)
        FROM (
          SELECT r.name AS role_name
          FROM role_menus rm
          JOIN roles r ON r.id = rm.role_id
          WHERE rm.menu_id = m.id
          ORDER BY r.name ASC
        )
      ), '[]') AS role_names_json,
      COALESCE((
        SELECT json_group_array(role_id)
        FROM (
          SELECT rm.role_id AS role_id
          FROM role_menus rm
          JOIN roles r ON r.id = rm.role_id
          WHERE rm.menu_id = m.id
          ORDER BY r.name ASC
        )
      ), '[]') AS role_ids_json
    FROM menus m
    LEFT JOIN menus p ON p.id = m.parent_id
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).all();

  const rows = (r.results || []).map(row => ({
    ...row,
    parent_label: row.parent_label || "",
    group_key: normalizeGroupKey(row.group_key) || "settings",
    role_names_json: safeJsonArray(row.role_names_json),
    role_ids_json: safeJsonArray(row.role_ids_json)
  }));

  return rows.map(row => ({
    ...row,
    audit: buildMenuAudit(row, rows)
  }));
}

async function replaceRoleMenus(env, menuId, roleIds){
  await env.DB.prepare(`
    DELETE FROM role_menus
    WHERE menu_id=?
  `).bind(menuId).run();

  const now = nowSec();
  const clean = Array.from(new Set(
    (Array.isArray(roleIds) ? roleIds : [])
      .map(x => String(x || "").trim())
      .filter(Boolean)
  ));

  for(const roleId of clean){
    await env.DB.prepare(`
      INSERT INTO role_menus (role_id, menu_id, created_at)
      VALUES (?, ?, ?)
    `).bind(roleId, menuId, now).run();
  }
}

function buildGroupCounts(menus){
  const counts = new Map();
  for(const key of ALLOWED_GROUP_KEYS) counts.set(key, 0);
  for(const row of (Array.isArray(menus) ? menus : [])){
    const key = String(row.group_key || "settings");
    counts.set(key, Number(counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([group_key, count]) => ({ group_key, count }));
}

function buildMenuAuditSummary(menus){
  const rows = Array.isArray(menus) ? menus : [];
  return {
    total_menus: rows.length,
    no_roles: rows.filter(x => x.audit?.flags?.includes("no_roles")).length,
    orphan_parent: rows.filter(x => x.audit?.flags?.includes("orphan_parent")).length,
    duplicate_path: rows.filter(x => x.audit?.flags?.includes("duplicate_path")).length,
    broad_role_coverage: rows.filter(x => x.audit?.flags?.includes("broad_role_coverage")).length
  };
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const [menus, roles] = await Promise.all([
    listMenus(env),
    listRoles(env)
  ]);

  return json(200, "ok", {
    menus,
    roles,
    group_keys: Array.from(ALLOWED_GROUP_KEYS),
    group_counts: buildGroupCounts(menus),
    audit_summary: buildMenuAuditSummary(menus)
  });
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
  const code = String(body.code || "").trim();
  const label = String(body.label || "").trim();
  const path = cleanPath(body.path || "/");
  const parent_id = String(body.parent_id || "").trim() || null;
  const sort_order = Number(body.sort_order ?? 50);
  const icon = String(body.icon || "").trim();
  const role_ids = Array.isArray(body.role_ids) ? body.role_ids : [];
  const group_key = normalizeGroupKey(body.group_key);
  const now = nowSec();

  if(!["create", "update", "delete"].includes(action)){
    return json(400, "invalid_input", { message: "invalid_action" });
  }

  if(action === "delete"){
    if(!id){
      return json(400, "invalid_input", { message: "id_required" });
    }

    const child = await env.DB.prepare(`
      SELECT id
      FROM menus
      WHERE parent_id=?
      LIMIT 1
    `).bind(id).first();

    if(child){
      return json(400, "invalid_input", { message: "menu_has_children" });
    }

    await env.DB.prepare(`DELETE FROM role_menus WHERE menu_id=?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM menus WHERE id=?`).bind(id).run();

    return json(200, "ok", { deleted: true, id });
  }

  if(!id || !code || !label){
    return json(400, "invalid_input", { message: "id_code_label_required" });
  }

  if(!group_key){
    return json(400, "invalid_input", { message: "invalid_group_key" });
  }

  if(id === code){
    return json(400, "invalid_input", { message: "id_must_differ_from_code" });
  }

  if(parent_id && parent_id === id){
    return json(400, "invalid_input", { message: "parent_invalid" });
  }

  if(action === "create"){
    const exists = await env.DB.prepare(`
      SELECT id
      FROM menus
      WHERE id=? OR code=?
      LIMIT 1
    `).bind(id, code).first();

    if(exists){
      return json(400, "invalid_input", { message: "menu_id_or_code_exists" });
    }

    await env.DB.prepare(`
      INSERT INTO menus (
        id, code, label, path, parent_id, sort_order, icon, created_at, group_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      code,
      label,
      path,
      parent_id,
      Number.isFinite(sort_order) ? sort_order : 50,
      icon || null,
      now,
      group_key
    ).run();

    await replaceRoleMenus(env, id, role_ids);

    return json(200, "ok", { created: true, id, group_key });
  }

  const exists = await env.DB.prepare(`
    SELECT id
    FROM menus
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!exists){
    return json(404, "not_found", { message: "menu_not_found" });
  }

  const codeConflict = await env.DB.prepare(`
    SELECT id
    FROM menus
    WHERE code=? AND id<>?
    LIMIT 1
  `).bind(code, id).first();

  if(codeConflict){
    return json(400, "invalid_input", { message: "menu_code_exists" });
  }

  await env.DB.prepare(`
    UPDATE menus
    SET code=?,
        label=?,
        path=?,
        parent_id=?,
        sort_order=?,
        icon=?,
        group_key=?
    WHERE id=?
  `).bind(
    code,
    label,
    path,
    parent_id,
    Number.isFinite(sort_order) ? sort_order : 50,
    icon || null,
    group_key,
    id
  ).run();

  await replaceRoleMenus(env, id, role_ids);

  return json(200, "ok", { updated: true, id, group_key });
}

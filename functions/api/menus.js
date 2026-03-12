import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";
import { readProtectedMenuPolicy, evaluateProtectedMenuMutation } from "./_menu_policy_guard.js";

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
  return [
    "dashboard","access","users","security",
    "content","ops","data","settings","audit"
  ].includes(x) ? x : "settings";
}

function uniqStrings(arr){
  return Array.from(new Set(
    (Array.isArray(arr) ? arr : [])
      .map(x => String(x || "").trim())
      .filter(Boolean)
  ));
}

async function menusHasGroupKey(env){
  try{
    const r = await env.DB.prepare(`PRAGMA table_info(menus)`).all();
    return (r.results || []).some(x => String(x.name || "").toLowerCase() === "group_key");
  }catch{
    return false;
  }
}

async function listRoles(env){
  const r = await env.DB.prepare(`
    SELECT id, name
    FROM roles
    ORDER BY name ASC
  `).all();

  return (r.results || []).map(x => ({
    id: String(x.id),
    name: String(x.name || "")
  }));
}

async function getMenuRow(env, id){
  const withGroup = await menusHasGroupKey(env);

  const sql = withGroup
    ? `
      SELECT id, code, label, path, parent_id, sort_order, icon, created_at, group_key
      FROM menus
      WHERE id = ?
      LIMIT 1
    `
    : `
      SELECT id, code, label, path, parent_id, sort_order, icon, created_at, 'settings' AS group_key
      FROM menus
      WHERE id = ?
      LIMIT 1
    `;

  const row = await env.DB.prepare(sql).bind(id).first();
  if(!row) return null;

  return {
    id: String(row.id || ""),
    code: String(row.code || ""),
    label: String(row.label || ""),
    path: cleanPath(row.path || "/"),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    sort_order: Number(row.sort_order ?? 50),
    icon: String(row.icon || ""),
    created_at: Number(row.created_at ?? 0),
    group_key: normalizeGroupKey(row.group_key)
  };
}

async function listMenus(env){
  const withGroup = await menusHasGroupKey(env);

  const sql = withGroup
    ? `
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
    `
    : `
      SELECT
        m.id,
        m.code,
        m.label,
        m.path,
        m.parent_id,
        m.sort_order,
        m.icon,
        m.created_at,
        'settings' AS group_key,
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
    `;

  const r = await env.DB.prepare(sql).all();

  const rows = (r.results || []).map(row => ({
    id: String(row.id),
    code: String(row.code || ""),
    label: String(row.label || ""),
    path: cleanPath(row.path || "/"),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    sort_order: Number(row.sort_order ?? 50),
    icon: String(row.icon || ""),
    created_at: Number(row.created_at ?? 0),
    group_key: normalizeGroupKey(row.group_key),
    parent_label: String(row.parent_label || ""),
    role_names_json: safeJsonArray(row.role_names_json).map(x => String(x)),
    role_ids_json: safeJsonArray(row.role_ids_json).map(x => String(x))
  }));

  return attachAudit(rows);
}

function attachAudit(rows){
  const byId = new Map(rows.map(x => [String(x.id), x]));
  const pathCount = new Map();

  for(const row of rows){
    const p = cleanPath(row.path || "/");
    pathCount.set(p, Number(pathCount.get(p) || 0) + 1);
  }

  return rows.map(row => {
    const flags = [];
    const roleCount = Array.isArray(row.role_ids_json) ? row.role_ids_json.length : 0;
    const duplicatePathCount = Number(pathCount.get(cleanPath(row.path || "/")) || 0);
    const broadCoverage = roleCount >= 4;
    const orphanParent = !!(row.parent_id && !byId.has(String(row.parent_id)));

    if(roleCount === 0) flags.push("no_roles");
    if(orphanParent) flags.push("orphan_parent");
    if(duplicatePathCount > 1) flags.push("duplicate_path");
    if(broadCoverage) flags.push("broad_role_coverage");

    return {
      ...row,
      audit: {
        role_count: roleCount,
        duplicate_path_count: duplicatePathCount,
        flags
      }
    };
  });
}

function buildGroupCounts(rows){
  const bucket = new Map();
  for(const row of rows || []){
    const g = normalizeGroupKey(row.group_key);
    bucket.set(g, Number(bucket.get(g) || 0) + 1);
  }
  return Array.from(bucket.entries()).map(([group_key, count]) => ({ group_key, count }));
}

function buildAuditSummary(rows){
  const items = Array.isArray(rows) ? rows : [];
  let no_roles = 0;
  let orphan_parent = 0;
  let duplicate_path = 0;
  let broad_role_coverage = 0;

  for(const row of items){
    const flags = Array.isArray(row?.audit?.flags) ? row.audit.flags : [];
    if(flags.includes("no_roles")) no_roles++;
    if(flags.includes("orphan_parent")) orphan_parent++;
    if(flags.includes("duplicate_path")) duplicate_path++;
    if(flags.includes("broad_role_coverage")) broad_role_coverage++;
  }

  return {
    total_menus: items.length,
    no_roles,
    orphan_parent,
    duplicate_path,
    broad_role_coverage
  };
}

async function replaceRoleMenus(env, menuId, roleIds){
  await env.DB.prepare(`
    DELETE FROM role_menus
    WHERE menu_id=?
  `).bind(menuId).run();

  const now = nowSec();
  const clean = uniqStrings(roleIds);

  for(const roleId of clean){
    await env.DB.prepare(`
      INSERT INTO role_menus (role_id, menu_id, created_at)
      VALUES (?, ?, ?)
    `).bind(roleId, menuId, now).run();
  }
}

async function hasDuplicatePath(env, path, excludeId = ""){
  const row = await env.DB.prepare(`
    SELECT id
    FROM menus
    WHERE path = ? AND id <> ?
    LIMIT 1
  `).bind(path, String(excludeId || "")).first();

  return !!row;
}

async function parentExists(env, parent_id){
  if(!parent_id) return true;
  const row = await env.DB.prepare(`
    SELECT id
    FROM menus
    WHERE id = ?
    LIMIT 1
  `).bind(parent_id).first();
  return !!row;
}

async function wouldCreateCycle(env, menuId, parent_id){
  if(!menuId || !parent_id) return false;
  if(String(menuId) === String(parent_id)) return true;

  let cursor = String(parent_id);
  const seen = new Set();

  while(cursor){
    if(seen.has(cursor)) break;
    seen.add(cursor);

    if(cursor === String(menuId)) return true;

    const row = await env.DB.prepare(`
      SELECT parent_id
      FROM menus
      WHERE id = ?
      LIMIT 1
    `).bind(cursor).first();

    cursor = row?.parent_id ? String(row.parent_id) : "";
  }

  return false;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const [menus, roles] = await Promise.all([
    listMenus(env),
    listRoles(env)
  ]);

  return json(200, "ok", {
    menus,
    roles,
    group_counts: buildGroupCounts(menus),
    audit_summary: buildAuditSummary(menus)
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin"])){
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

  const policy = await readProtectedMenuPolicy(env);

  if(action === "delete"){
    if(!id){
      return json(400, "invalid_input", { message: "id_required" });
    }

    const originalRow = await getMenuRow(env, id);
    if(!originalRow){
      return json(404, "not_found", { message: "menu_not_found" });
    }

    const check = evaluateProtectedMenuMutation(policy, originalRow, originalRow, "delete");
    if(!check.ok){
      return json(400, check.code, { message: check.message });
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

  if(id === code){
    return json(400, "invalid_input", { message: "id_must_differ_from_code" });
  }

  if(parent_id && parent_id === id){
    return json(400, "invalid_input", { message: "parent_invalid" });
  }

  if(!(await parentExists(env, parent_id))){
    return json(400, "invalid_input", { message: "parent_not_found" });
  }

  if(await hasDuplicatePath(env, path, action === "update" ? id : "")){
    return json(400, "invalid_input", { message: "menu_path_exists" });
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

    const withGroup = await menusHasGroupKey(env);

    if(withGroup){
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
    }else{
      await env.DB.prepare(`
        INSERT INTO menus (
          id, code, label, path, parent_id, sort_order, icon, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        code,
        label,
        path,
        parent_id,
        Number.isFinite(sort_order) ? sort_order : 50,
        icon || null,
        now
      ).run();
    }

    await replaceRoleMenus(env, id, role_ids);

    return json(200, "ok", {
      created: true,
      id
    });
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

  if(await wouldCreateCycle(env, id, parent_id)){
    return json(400, "invalid_input", { message: "parent_cycle_detected" });
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

  const originalRow = await getMenuRow(env, id);
  const draft = {
    id,
    code,
    label,
    path,
    parent_id,
    sort_order: Number.isFinite(sort_order) ? sort_order : 50,
    icon: icon || "",
    group_key
  };

  const check = evaluateProtectedMenuMutation(policy, originalRow, draft, "update");
  if(!check.ok){
    return json(400, check.code, { message: check.message });
  }

  const withGroup = await menusHasGroupKey(env);

  if(withGroup){
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
  }else{
    await env.DB.prepare(`
      UPDATE menus
      SET code=?,
          label=?,
          path=?,
          parent_id=?,
          sort_order=?,
          icon=?
      WHERE id=?
    `).bind(
      code,
      label,
      path,
      parent_id,
      Number.isFinite(sort_order) ? sort_order : 50,
      icon || null,
      id
    ).run();
  }

  await replaceRoleMenus(env, id, role_ids);

  return json(200, "ok", {
    updated: true,
    id
  });
}

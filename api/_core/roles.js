import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

const GROUP_ORDER = [
  "dashboard",
  "access",
  "users",
  "security",
  "content",
  "ops",
  "data",
  "settings",
  "audit"
];

const ALLOWED_GROUP_KEYS = new Set(GROUP_ORDER);
const PROTECTED_ROLE_IDS = new Set(["super_admin","admin","staff","client","talent"]);

function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return ALLOWED_GROUP_KEYS.has(x) ? x : "settings";
}

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

function buildGroupSummary(items){
  const byGroup = new Map();
  for(const key of GROUP_ORDER) byGroup.set(key, 0);

  for(const item of (Array.isArray(items) ? items : [])){
    const key = normalizeGroupKey(item.group_key);
    byGroup.set(key, Number(byGroup.get(key) || 0) + 1);
  }

  return GROUP_ORDER
    .map(group_key => ({
      group_key,
      count: Number(byGroup.get(group_key) || 0)
    }))
    .filter(x => x.count > 0);
}

function buildRoleAudit(row){
  const usageCount = Number(row.menu_usage_count || 0);
  const groups = Array.isArray(row.group_usage_summary) ? row.group_usage_summary : [];
  const distinctGroups = groups.length;
  const flags = [];

  if(PROTECTED_ROLE_IDS.has(String(row.id || ""))){
    flags.push("protected_role");
  }
  if(usageCount === 0){
    flags.push("unused_role");
  }
  if(usageCount >= 12){
    flags.push("broad_access");
  }
  if(distinctGroups === 1 && usageCount > 0){
    flags.push("single_domain_role");
  }
  if(distinctGroups >= 4){
    flags.push("cross_domain_role");
  }

  return {
    usage_count: usageCount,
    distinct_groups: distinctGroups,
    flags
  };
}

async function listTemplateCatalog(env){
  const r = await env.DB.prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(LOWER(group_key)), ''), 'settings') AS group_key,
      COUNT(1) AS menu_count
    FROM menus
    GROUP BY COALESCE(NULLIF(TRIM(LOWER(group_key)), ''), 'settings')
  `).all();

  const counts = new Map();
  for(const row of (r.results || [])){
    counts.set(normalizeGroupKey(row.group_key), Number(row.menu_count || 0));
  }

  return GROUP_ORDER.map(group_key => ({
    group_key,
    menu_count: Number(counts.get(group_key) || 0)
  }));
}

async function listRoles(env){
  const r = await env.DB.prepare(`
    SELECT
      r.id,
      r.name,
      r.description,
      r.created_at,
      COALESCE((
        SELECT COUNT(1)
        FROM role_menus rm
        WHERE rm.role_id = r.id
      ), 0) AS menu_usage_count,
      COALESCE((
        SELECT json_group_array(json_object(
          'id', m.id,
          'code', m.code,
          'label', m.label,
          'path', m.path,
          'group_key', COALESCE(NULLIF(TRIM(LOWER(m.group_key)), ''), 'settings')
        ))
        FROM (
          SELECT
            m.id,
            m.code,
            m.label,
            m.path,
            m.group_key
          FROM role_menus rm
          JOIN menus m ON m.id = rm.menu_id
          WHERE rm.role_id = r.id
          ORDER BY m.sort_order ASC, m.created_at ASC
        ) m
      ), '[]') AS menu_usage_items_json
    FROM roles r
    ORDER BY r.name ASC
  `).all();

  return (r.results || []).map(row => {
    const usageItems = safeJsonArray(row.menu_usage_items_json).map(x => ({
      id: String(x?.id || ""),
      code: String(x?.code || ""),
      label: String(x?.label || ""),
      path: String(x?.path || ""),
      group_key: normalizeGroupKey(x?.group_key)
    }));

    const mapped = {
      id: String(row.id || ""),
      name: String(row.name || ""),
      description: String(row.description || ""),
      created_at: Number(row.created_at ?? 0),
      menu_usage_count: Number(row.menu_usage_count ?? 0),
      menu_usage_items: usageItems,
      group_usage_summary: buildGroupSummary(usageItems)
    };

    mapped.audit = buildRoleAudit(mapped);
    return mapped;
  });
}

async function getRole(env, id){
  return await env.DB.prepare(`
    SELECT id, name
    FROM roles
    WHERE id=?
    LIMIT 1
  `).bind(id).first();
}

async function getMenuItemsByGroups(env, groups){
  const clean = Array.from(new Set(
    (Array.isArray(groups) ? groups : [])
      .map(normalizeGroupKey)
      .filter(Boolean)
  ));

  if(!clean.length) return [];

  const placeholders = clean.map(() => "?").join(",");
  const r = await env.DB.prepare(`
    SELECT
      id,
      code,
      label,
      path,
      COALESCE(NULLIF(TRIM(LOWER(group_key)), ''), 'settings') AS group_key
    FROM menus
    WHERE COALESCE(NULLIF(TRIM(LOWER(group_key)), ''), 'settings') IN (${placeholders})
    ORDER BY sort_order ASC, created_at ASC
  `).bind(...clean).all();

  return (r.results || []).map(x => ({
    id: String(x.id || ""),
    code: String(x.code || ""),
    label: String(x.label || ""),
    path: String(x.path || ""),
    group_key: normalizeGroupKey(x.group_key)
  }));
}

async function getCurrentRoleMenuItems(env, roleId){
  const r = await env.DB.prepare(`
    SELECT
      m.id,
      m.code,
      m.label,
      m.path,
      COALESCE(NULLIF(TRIM(LOWER(m.group_key)), ''), 'settings') AS group_key
    FROM role_menus rm
    JOIN menus m ON m.id = rm.menu_id
    WHERE rm.role_id=?
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).bind(roleId).all();

  return (r.results || []).map(x => ({
    id: String(x.id || ""),
    code: String(x.code || ""),
    label: String(x.label || ""),
    path: String(x.path || ""),
    group_key: normalizeGroupKey(x.group_key)
  }));
}

function buildTemplateDiff(currentItems, targetItems, mode){
  const currentMap = new Map((Array.isArray(currentItems) ? currentItems : []).map(x => [String(x.id), x]));
  const targetMap = new Map((Array.isArray(targetItems) ? targetItems : []).map(x => [String(x.id), x]));

  const unchanged = [];
  const to_add = [];
  const to_remove = [];

  if(mode === "replace"){
    for(const item of currentMap.values()){
      if(targetMap.has(item.id)) unchanged.push(item);
      else to_remove.push(item);
    }
    for(const item of targetMap.values()){
      if(!currentMap.has(item.id)) to_add.push(item);
    }
  }else if(mode === "add"){
    for(const item of targetMap.values()){
      if(currentMap.has(item.id)) unchanged.push(item);
      else to_add.push(item);
    }
  }else if(mode === "remove"){
    for(const item of targetMap.values()){
      if(currentMap.has(item.id)) to_remove.push(item);
    }
    for(const item of currentMap.values()){
      if(!targetMap.has(item.id)) unchanged.push(item);
    }
  }

  return {
    to_add,
    to_remove,
    unchanged
  };
}

async function applyTemplateToRole(env, roleId, groups, mode){
  const cleanGroups = Array.from(new Set(
    (Array.isArray(groups) ? groups : [])
      .map(normalizeGroupKey)
      .filter(Boolean)
  ));

  if(!cleanGroups.length){
    return { ok:false, message:"groups_required" };
  }

  const targetItems = await getMenuItemsByGroups(env, cleanGroups);
  const targetMenuIds = targetItems.map(x => x.id);
  const now = nowSec();

  if(mode === "replace"){
    await env.DB.prepare(`
      DELETE FROM role_menus
      WHERE role_id=?
    `).bind(roleId).run();

    for(const menuId of targetMenuIds){
      await env.DB.prepare(`
        INSERT INTO role_menus (role_id, menu_id, created_at)
        VALUES (?, ?, ?)
      `).bind(roleId, menuId, now).run();
    }

    return { ok:true, affected_menus: targetMenuIds.length };
  }

  if(mode === "add"){
    for(const menuId of targetMenuIds){
      const exists = await env.DB.prepare(`
        SELECT 1
        FROM role_menus
        WHERE role_id=? AND menu_id=?
        LIMIT 1
      `).bind(roleId, menuId).first();

      if(!exists){
        await env.DB.prepare(`
          INSERT INTO role_menus (role_id, menu_id, created_at)
          VALUES (?, ?, ?)
        `).bind(roleId, menuId, now).run();
      }
    }

    return { ok:true, affected_menus: targetMenuIds.length };
  }

  if(mode === "remove"){
    if(targetMenuIds.length){
      const placeholders = targetMenuIds.map(() => "?").join(",");
      await env.DB.prepare(`
        DELETE FROM role_menus
        WHERE role_id=?
          AND menu_id IN (${placeholders})
      `).bind(roleId, ...targetMenuIds).run();
    }

    return { ok:true, affected_menus: targetMenuIds.length };
  }

  return { ok:false, message:"invalid_template_mode" };
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const [items, template_catalog] = await Promise.all([
    listRoles(env),
    listTemplateCatalog(env)
  ]);

  const audit_summary = {
    total_roles: items.length,
    protected_roles: items.filter(x => x.audit.flags.includes("protected_role")).length,
    unused_roles: items.filter(x => x.audit.flags.includes("unused_role")).length,
    broad_access_roles: items.filter(x => x.audit.flags.includes("broad_access")).length,
    single_domain_roles: items.filter(x => x.audit.flags.includes("single_domain_role")).length,
    cross_domain_roles: items.filter(x => x.audit.flags.includes("cross_domain_role")).length
  };

  return json(200, "ok", {
    items,
    template_catalog,
    group_keys: GROUP_ORDER,
    audit_summary
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
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const now = nowSec();

  if(!["create", "update", "delete", "apply_template", "preview_template"].includes(action)){
    return json(400, "invalid_input", { message:"invalid_action" });
  }

  if(action === "preview_template"){
    const role_id = String(body.role_id || body.id || "").trim();
    const mode = String(body.mode || "").trim().toLowerCase();
    const groups = Array.isArray(body.groups) ? body.groups : [];

    if(!role_id){
      return json(400, "invalid_input", { message:"role_id_required" });
    }
    if(!["replace", "add", "remove"].includes(mode)){
      return json(400, "invalid_input", { message:"invalid_template_mode" });
    }

    const role = await getRole(env, role_id);
    if(!role){
      return json(404, "not_found", { message:"role_not_found" });
    }

    const cleanGroups = Array.from(new Set(groups.map(normalizeGroupKey).filter(Boolean)));
    if(!cleanGroups.length){
      return json(400, "invalid_input", { message:"groups_required" });
    }

    const [currentItems, targetItems] = await Promise.all([
      getCurrentRoleMenuItems(env, role_id),
      getMenuItemsByGroups(env, cleanGroups)
    ]);

    const diff = buildTemplateDiff(currentItems, targetItems, mode);

    return json(200, "ok", {
      preview: true,
      role_id,
      mode,
      groups: cleanGroups,
      diff: {
        to_add: diff.to_add,
        to_remove: diff.to_remove,
        unchanged: diff.unchanged,
        counts: {
          to_add: diff.to_add.length,
          to_remove: diff.to_remove.length,
          unchanged: diff.unchanged.length
        }
      }
    });
  }

  if(action === "apply_template"){
    const role_id = String(body.role_id || body.id || "").trim();
    const mode = String(body.mode || "").trim().toLowerCase();
    const groups = Array.isArray(body.groups) ? body.groups : [];

    if(!role_id){
      return json(400, "invalid_input", { message:"role_id_required" });
    }
    if(!["replace", "add", "remove"].includes(mode)){
      return json(400, "invalid_input", { message:"invalid_template_mode" });
    }

    const role = await getRole(env, role_id);
    if(!role){
      return json(404, "not_found", { message:"role_not_found" });
    }

    const cleanGroups = Array.from(new Set(groups.map(normalizeGroupKey).filter(Boolean)));
    if(!cleanGroups.length){
      return json(400, "invalid_input", { message:"groups_required" });
    }

    const applied = await applyTemplateToRole(env, role_id, cleanGroups, mode);
    if(!applied.ok){
      return json(400, "invalid_input", { message: applied.message || "template_apply_failed" });
    }

    return json(200, "ok", {
      applied: true,
      role_id,
      mode,
      groups: cleanGroups,
      affected_menus: applied.affected_menus
    });
  }

  if(action === "delete"){
    if(!id){
      return json(400, "invalid_input", { message:"id_required" });
    }

    if(PROTECTED_ROLE_IDS.has(id)){
      return json(400, "invalid_input", { message:"protected_role" });
    }

    const inUse = await env.DB.prepare(`
      SELECT COUNT(1) AS c
      FROM role_menus
      WHERE role_id=?
    `).bind(id).first();

    const usageCount = Number(inUse?.c || 0);
    if(usageCount > 0){
      return json(400, "invalid_input", {
        message:"role_in_use_by_menus",
        menu_usage_count: usageCount
      });
    }

    await env.DB.prepare(`DELETE FROM roles WHERE id=?`).bind(id).run();
    return json(200, "ok", { deleted:true, id });
  }

  if(!id || !name){
    return json(400, "invalid_input", { message:"id_name_required" });
  }

  if(action === "create"){
    const exists = await env.DB.prepare(`
      SELECT id
      FROM roles
      WHERE id=? OR name=?
      LIMIT 1
    `).bind(id, name).first();

    if(exists){
      return json(400, "invalid_input", { message:"role_id_or_name_exists" });
    }

    await env.DB.prepare(`
      INSERT INTO roles (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(id, name, description || null, now).run();

    return json(200, "ok", { created:true, id });
  }

  const exists = await env.DB.prepare(`
    SELECT id
    FROM roles
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!exists){
    return json(404, "not_found", { message:"role_not_found" });
  }

  const nameConflict = await env.DB.prepare(`
    SELECT id
    FROM roles
    WHERE name=? AND id<>?
    LIMIT 1
  `).bind(name, id).first();

    if(nameConflict){
      return json(400, "invalid_input", { message:"role_name_exists" });
    }

  await env.DB.prepare(`
    UPDATE roles
    SET name=?, description=?
    WHERE id=?
  `).bind(name, description || null, id).run();

  return json(200, "ok", { updated:true, id });
}

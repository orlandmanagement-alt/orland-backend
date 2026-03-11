import { json, requireAuth, hasRole } from "../_lib.js";

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

function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return ALLOWED_GROUP_KEYS.has(x) ? x : "settings";
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const rows = await env.DB.prepare(`
    SELECT
      m.id,
      m.code,
      m.label,
      m.path,
      m.parent_id,
      m.sort_order,
      m.icon,
      m.group_key
    FROM menus m
    WHERE EXISTS (
      SELECT 1
      FROM role_menus rm
      JOIN roles r ON r.id = rm.role_id
      WHERE rm.menu_id = m.id
        AND r.name IN (${a.roles.map(() => "?").join(",") || "''"})
    )
    ORDER BY
      CASE normalize_group
        WHEN 'dashboard' THEN 1
        WHEN 'access' THEN 2
        WHEN 'users' THEN 3
        WHEN 'security' THEN 4
        WHEN 'content' THEN 5
        WHEN 'ops' THEN 6
        WHEN 'data' THEN 7
        WHEN 'settings' THEN 8
        WHEN 'audit' THEN 9
        ELSE 99
      END,
      m.sort_order ASC,
      m.created_at ASC
  `.replace("normalize_group", "COALESCE(NULLIF(TRIM(LOWER(m.group_key)), ''), 'settings')"))
    .bind(...a.roles)
    .all();

  const items = (rows.results || []).map(row => ({
    id: String(row.id || ""),
    code: String(row.code || ""),
    label: String(row.label || ""),
    path: String(row.path || "/"),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    sort_order: Number(row.sort_order ?? 9999),
    icon: String(row.icon || ""),
    group_key: normalizeGroupKey(row.group_key)
  }));

  return json(200, "ok", {
    items,
    groups: GROUP_ORDER
  });
}

import { json, requireAuth, hasRole } from "../../_lib.js";

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/, "");
  return p || "/";
}

function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return [
    "dashboard","access","users","security",
    "content","ops","data","settings","audit"
  ].includes(x) ? x : "settings";
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin", "audit_admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const role_name = String(url.searchParams.get("role_name") || "").trim();

  if(!role_name){
    return json(400, "invalid_input", { message:"role_name_required" });
  }

  const role = await env.DB.prepare(`
    SELECT id, name
    FROM roles
    WHERE lower(name) = lower(?)
    LIMIT 1
  `).bind(role_name).first();

  if(!role){
    return json(404, "not_found", { message:"role_not_found" });
  }

  const rows = await env.DB.prepare(`
    SELECT m.id, m.code, m.label, m.path, m.parent_id, m.sort_order, m.icon, m.group_key
    FROM role_menus rm
    JOIN menus m ON m.id = rm.menu_id
    WHERE rm.role_id = ?
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).bind(String(role.id || "")).all();

  const menus = (rows.results || []).map(x => ({
    id: String(x.id || ""),
    code: String(x.code || ""),
    label: String(x.label || ""),
    path: normPath(x.path || "/"),
    parent_id: x.parent_id ? String(x.parent_id) : null,
    sort_order: Number(x.sort_order || 9999),
    icon: String(x.icon || ""),
    group_key: normalizeGroupKey(x.group_key)
  }));

  const grouped_counts = {};
  for(const m of menus){
    const g = normalizeGroupKey(m.group_key);
    grouped_counts[g] = Number(grouped_counts[g] || 0) + 1;
  }

  return json(200, "ok", {
    role: {
      id: String(role.id || ""),
      name: String(role.name || "")
    },
    total_menus: menus.length,
    grouped_counts,
    menus
  });
}

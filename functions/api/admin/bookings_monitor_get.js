import { json, requireAuth } from "../../_lib.js";

function canAccessAdmin(roles){
  const set = new Set((roles || []).map(String));
  return (
    set.has("super_admin") ||
    set.has("admin") ||
    set.has("staff") ||
    set.has("ops_admin") ||
    set.has("audit_admin")
  );
}

function clampLimit(v){
  const n = Number(v || 20);
  return Math.max(1, Math.min(100, n));
}

function clampOffset(v){
  const n = Number(v || 0);
  return Math.max(0, n);
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessAdmin(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const limit = clampLimit(url.searchParams.get("limit"));
  const offset = clampOffset(url.searchParams.get("offset"));

  let sql = `
    SELECT
      b.id,
      b.project_role_id,
      b.talent_user_id,
      b.status,
      b.notes,
      b.created_at,
      b.updated_at,
      pr.role_name,
      p.id AS project_id,
      p.title AS project_title,
      u.display_name AS talent_name
    FROM project_bookings b
    LEFT JOIN project_roles pr ON pr.id = b.project_role_id
    LEFT JOIN projects p ON p.id = pr.project_id
    LEFT JOIN users u ON u.id = b.talent_user_id
  `;
  const binds = [];

  if(q){
    sql += ` WHERE p.title LIKE ? OR u.display_name LIKE ? OR b.id LIKE ? `;
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ? `;
  binds.push(limit, offset);

  try{
    const r = await env.DB.prepare(sql).bind(...binds).all();
    return json(200, "ok", {
      items: r.results || [],
      paging: { limit, offset, next_offset: offset + limit, prev_offset: Math.max(0, offset - limit) }
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_bookings_monitor",
      detail: String(err?.message || err)
    });
  }
}

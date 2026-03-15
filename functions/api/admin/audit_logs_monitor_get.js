import { json, requireAuth } from "../../_lib.js";

function canAccessAdmin(roles){
  const s = new Set((roles || []).map(String));
  return s.has("super_admin") || s.has("admin") || s.has("audit_admin") || s.has("security_admin") || s.has("staff");
}

function clampLimit(v){
  const n = Number(v || 50);
  return Math.max(1, Math.min(200, n));
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
      id,
      actor_user_id,
      actor_identifier_hash,
      action,
      target_type,
      target_id,
      ip_hash,
      meta_json,
      created_at,
      ua_hash,
      route,
      http_status,
      duration_ms
    FROM audit_logs
  `;
  const binds = [];

  if(q){
    sql += ` WHERE action LIKE ? OR route LIKE ? OR target_id LIKE ? `;
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ? `;
  binds.push(limit, offset);

  try{
    const r = await env.DB.prepare(sql).bind(...binds).all();
    return json(200, "ok", {
      items: r.results || [],
      paging: {
        limit,
        offset,
        next_offset: offset + limit,
        prev_offset: Math.max(0, offset - limit)
      }
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_audit_logs_monitor",
      detail: String(err?.message || err)
    });
  }
}

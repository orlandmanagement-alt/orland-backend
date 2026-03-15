import { json, requireAuth, nowSec } from "../../_lib.js";

function canAccessAdmin(roles){
  const s = new Set((roles || []).map(String));
  return s.has("super_admin") || s.has("admin") || s.has("security_admin") || s.has("audit_admin") || s.has("staff");
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

  const now = nowSec();
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const activeOnly = String(url.searchParams.get("active_only") || "1") === "1";
  const limit = clampLimit(url.searchParams.get("limit"));
  const offset = clampOffset(url.searchParams.get("offset"));

  let sql = `
    SELECT
      s.id,
      s.user_id,
      s.expires_at,
      s.revoked_at,
      s.last_seen_at,
      s.created_at,
      s.revoke_reason,
      s.roles_json,
      u.display_name,
      u.email_norm
    FROM sessions s
    LEFT JOIN users u ON u.id = s.user_id
  `;
  const binds = [];
  const where = [];

  if(activeOnly){
    where.push(`s.revoked_at IS NULL AND s.expires_at > ?`);
    binds.push(now);
  }

  if(q){
    where.push(`(s.id LIKE ? OR s.user_id LIKE ? OR u.display_name LIKE ? OR u.email_norm LIKE ?)`);
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  if(where.length){
    sql += ` WHERE ${where.join(" AND ")} `;
  }

  sql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ? `;
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
      message: "failed_to_load_sessions_monitor",
      detail: String(err?.message || err)
    });
  }
}

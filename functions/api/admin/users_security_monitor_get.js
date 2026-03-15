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
  const riskOnly = String(url.searchParams.get("risk_only") || "0") === "1";
  const limit = clampLimit(url.searchParams.get("limit"));
  const offset = clampOffset(url.searchParams.get("offset"));

  let sql = `
    SELECT
      u.id,
      u.email_norm,
      u.display_name,
      u.status,
      u.locked_until,
      u.lock_reason,
      u.disabled_at,
      u.disabled_reason,
      u.last_login_at,
      u.last_login_success_at,
      u.last_login_fail_at,
      u.pw_fail_count,
      u.pw_fail_last_at,
      u.session_version,
      u.mfa_enabled
    FROM users u
  `;
  const binds = [];
  const where = [];

  if(q){
    where.push(`(u.id LIKE ? OR u.email_norm LIKE ? OR u.display_name LIKE ?)`);
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if(riskOnly){
    where.push(`(
      (u.locked_until IS NOT NULL AND u.locked_until > ?)
      OR COALESCE(u.pw_fail_count, 0) > 0
      OR u.disabled_at IS NOT NULL
    )`);
    binds.push(now);
  }

  if(where.length){
    sql += ` WHERE ${where.join(" AND ")} `;
  }

  sql += ` ORDER BY COALESCE(u.locked_until, 0) DESC, COALESCE(u.last_login_fail_at, 0) DESC, u.updated_at DESC LIMIT ? OFFSET ? `;
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
      message: "failed_to_load_users_security_monitor",
      detail: String(err?.message || err)
    });
  }
}

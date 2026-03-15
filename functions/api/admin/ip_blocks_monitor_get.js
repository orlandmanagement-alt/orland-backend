import { json, requireAuth, nowSec } from "../../_lib.js";

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
  const activeOnly = String(url.searchParams.get("active_only") || "1") === "1";
  const limit = clampLimit(url.searchParams.get("limit"));
  const offset = clampOffset(url.searchParams.get("offset"));
  const now = nowSec();

  let sql = `
    SELECT
      id,
      ip_hash,
      reason,
      expires_at,
      revoked_at,
      created_at,
      created_by_user_id
    FROM ip_blocks
  `;
  const binds = [];

  if(activeOnly){
    sql += ` WHERE revoked_at IS NULL AND expires_at > ? `;
    binds.push(now);
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
      message: "failed_to_load_ip_blocks_monitor",
      detail: String(err?.message || err)
    });
  }
}

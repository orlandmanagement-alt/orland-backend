import { json, requireAuth } from "../../_lib.js";

function canAccessAdmin(roles){
  const s = new Set((roles || []).map(String));
  return s.has("super_admin") || s.has("admin") || s.has("audit_admin") || s.has("security_admin") || s.has("staff");
}

function clampLimit(v){
  const n = Number(v || 50);
  return Math.max(1, Math.min(200, n));
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

  let sql = `
    SELECT
      k,
      count,
      window_start,
      updated_at
    FROM request_counters
  `;
  const binds = [];

  if(q){
    sql += ` WHERE k LIKE ? `;
    binds.push(`%${q}%`);
  }

  sql += ` ORDER BY updated_at DESC LIMIT ? `;
  binds.push(limit);

  try{
    const r = await env.DB.prepare(sql).bind(...binds).all();
    return json(200, "ok", {
      items: r.results || []
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_request_counters_monitor",
      detail: String(err?.message || err)
    });
  }
}

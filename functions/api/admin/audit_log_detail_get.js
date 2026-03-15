import { json, requireAuth } from "../../_lib.js";

function canAccessAdmin(roles){
  const s = new Set((roles || []).map(String));
  return s.has("super_admin") || s.has("admin") || s.has("audit_admin") || s.has("security_admin") || s.has("staff");
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;
  if(!canAccessAdmin(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if(!id){
    return json(400, "invalid_input", { message: "id_required" });
  }

  try{
    const row = await env.DB.prepare(`
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
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if(!row){
      return json(404, "not_found", { message: "audit_log_not_found" });
    }

    let meta = null;
    try{
      meta = row.meta_json ? JSON.parse(row.meta_json) : null;
    }catch{
      meta = row.meta_json || null;
    }

    return json(200, "ok", {
      ...row,
      meta
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_audit_log_detail",
      detail: String(err?.message || err)
    });
  }
}

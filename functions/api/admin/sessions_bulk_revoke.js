import { json, requireAuth, nowSec, auditEvent } from "../../_lib.js";

function canAccessAdmin(roles){
  const s = new Set((roles || []).map(String));
  return s.has("super_admin") || s.has("admin") || s.has("security_admin");
}

async function readJsonSafe(request){
  try{
    return await request.json();
  }catch{
    return {};
  }
}

export async function onRequestPost({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;
  if(!canAccessAdmin(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const body = await readJsonSafe(request);
  const sessionIds = Array.isArray(body.session_ids) ? body.session_ids.map(String).filter(Boolean) : [];
  const reason = String(body.reason || "admin_bulk_revoke").trim() || "admin_bulk_revoke";

  if(!sessionIds.length){
    return json(400, "invalid_input", { message: "session_ids_required" });
  }

  try{
    let affected = 0;
    for(const sid of sessionIds){
      const r = await env.DB.prepare(`
        UPDATE sessions
        SET revoked_at = ?, revoke_reason = ?
        WHERE id = ? AND revoked_at IS NULL
      `).bind(nowSec(), reason, sid).run();

      affected += Number(r?.meta?.changes || 0);
    }

    await auditEvent(env, request, {
      actor_user_id: auth.uid,
      action: "admin_bulk_revoke_sessions",
      http_status: 200,
      meta: { count: sessionIds.length, affected, reason }
    });

    return json(200, "ok", {
      requested: sessionIds.length,
      affected,
      reason
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_revoke_sessions",
      detail: String(err?.message || err)
    });
  }
}

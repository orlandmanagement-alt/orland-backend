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
  const userId = String(body.user_id || "").trim();
  const enabled = Number(body.enabled || 1) === 1 ? 1 : 0;

  if(!userId){
    return json(400, "invalid_input", { message: "user_id_required" });
  }

  try{
    const r = await env.DB.prepare(`
      UPDATE users
      SET
        require_mfa_enroll = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(enabled, nowSec(), userId).run();

    await auditEvent(env, request, {
      actor_user_id: auth.uid,
      action: enabled ? "admin_require_mfa_enrollment" : "admin_clear_mfa_enrollment_requirement",
      target_type: "user",
      target_id: userId,
      http_status: 200,
      meta: { enabled, affected: Number(r?.meta?.changes || 0) }
    });

    return json(200, "ok", {
      user_id: userId,
      enabled,
      affected: Number(r?.meta?.changes || 0)
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_update_require_mfa_enroll",
      detail: String(err?.message || err)
    });
  }
}

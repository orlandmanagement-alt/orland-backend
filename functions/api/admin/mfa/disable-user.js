import { json, readJson, requireAuth, hasRole, auditEvent, sha256Base64 } from "../../../_lib.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "security_admin"])){
    return json(403, "forbidden", { message:"only_super_admin_or_security_admin" });
  }

  const body = await readJson(request) || {};
  const user_id = String(body.user_id || "").trim();
  const clear_recovery_codes = body.clear_recovery_codes !== false;
  const rotate_session_version = body.rotate_session_version !== false;
  const revoke_sessions = body.revoke_sessions !== false;

  if(!user_id){
    return json(400, "invalid_input", { message:"user_id_required" });
  }

  const user = await env.DB.prepare(`
    SELECT id, email_norm, display_name, session_version
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(user_id).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  const nextVersion = rotate_session_version
    ? Number(user.session_version || 1) + 1
    : Number(user.session_version || 1);

  await env.DB.prepare(`
    UPDATE users
    SET
      mfa_enabled = 0,
      mfa_type = NULL,
      mfa_secret = NULL,
      recovery_codes_json = ?,
      session_version = ?,
      updated_at = strftime('%s','now')
    WHERE id = ?
  `).bind(
    clear_recovery_codes ? null : user.recovery_codes_json || null,
    nextVersion,
    user_id
  ).run();

  if(revoke_sessions){
    await env.DB.prepare(`
      UPDATE sessions
      SET revoked_at = strftime('%s','now'),
          revoke_reason = 'admin_disabled_user_mfa'
      WHERE user_id = ?
        AND revoked_at IS NULL
    `).bind(user_id).run();
  }

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "admin_disabled_user_mfa",
      ip_hash: ipHash,
      http_status: 200,
      meta: {
        target_user_id: user_id,
        target_email_norm: user.email_norm || null,
        clear_recovery_codes,
        rotate_session_version,
        revoke_sessions,
        new_session_version: nextVersion
      }
    });
  }catch{}

  return json(200, "ok", {
    disabled: true,
    user_id,
    clear_recovery_codes,
    rotate_session_version,
    revoke_sessions,
    new_session_version: nextVersion
  });
}

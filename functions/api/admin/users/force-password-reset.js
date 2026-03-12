import {
  json,
  readJson,
  requireAuth,
  hasRole,
  pbkdf2Hash,
  randomB64,
  nowSec,
  auditEvent,
  sha256Base64
} from "../../../_lib.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const user_id = String(body.user_id || "").trim();
  const temporary_password = String(body.temporary_password || "");
  const set_temporary_password = body.set_temporary_password === true;
  const force_revoke_sessions = body.force_revoke_sessions !== false;

  if(!user_id){
    return json(400, "invalid_input", { message:"user_id_required" });
  }

  const user = await env.DB.prepare(`
    SELECT
      id,
      email_norm,
      display_name,
      status,
      session_version
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(user_id).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  const now = nowSec();
  const nextSessionVersion = Number(user.session_version || 1) + 1;

  if(set_temporary_password){
    if(temporary_password.length < 10){
      return json(400, "invalid_input", { message:"temporary_password_min_10" });
    }

    const salt = randomB64(16);
    const iter = 100000;
    const hash = await pbkdf2Hash(temporary_password, salt, iter);

    await env.DB.prepare(`
      UPDATE users
      SET
        password_hash = ?,
        password_salt = ?,
        password_iter = ?,
        password_algo = ?,
        must_change_password = 1,
        pw_fail_count = 0,
        pw_fail_last_at = NULL,
        locked_until = NULL,
        lock_reason = NULL,
        session_version = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      hash,
      salt,
      iter,
      "pbkdf2_sha256",
      nextSessionVersion,
      now,
      user_id
    ).run();
  }else{
    await env.DB.prepare(`
      UPDATE users
      SET
        must_change_password = 1,
        session_version = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      nextSessionVersion,
      now,
      user_id
    ).run();
  }

  if(force_revoke_sessions){
    await env.DB.prepare(`
      UPDATE sessions
      SET revoked_at = ?, revoke_reason = ?
      WHERE user_id = ? AND revoked_at IS NULL
    `).bind(now, "admin_forced_password_reset", user_id).run();
  }

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "admin_force_password_reset",
      ip_hash: ipHash,
      http_status: 200,
      meta: {
        target_user_id: user_id,
        target_email_norm: user.email_norm || null,
        set_temporary_password,
        force_revoke_sessions,
        new_session_version: nextSessionVersion
      }
    });
  }catch{}

  return json(200, "ok", {
    forced: true,
    user_id,
    set_temporary_password,
    force_revoke_sessions,
    must_change_password: true,
    new_session_version: nextSessionVersion
  });
}

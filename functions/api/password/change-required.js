import {
  json,
  readJson,
  requireAuth,
  pbkdf2Hash,
  timingSafeEqual,
  randomB64,
  nowSec,
  revokeAllSessionsForUser,
  auditEvent,
  sha256Base64
} from "../../_lib.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  return json(200, "ok", {
    user: {
      id: a.user?.id || a.uid,
      email_norm: a.user?.email_norm || null,
      display_name: a.user?.display_name || null
    },
    must_change_password: Number(a.user?.must_change_password || 0) === 1
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const current_password = String(body.current_password || "");
  const new_password = String(body.new_password || "");
  const revoke_others = body.revoke_others !== false;

  if(!current_password || new_password.length < 10){
    return json(400, "invalid_input", { message:"current_password_and_new_password_required" });
  }

  const user = await env.DB.prepare(`
    SELECT
      id,
      email_norm,
      password_hash,
      password_salt,
      password_iter,
      session_version,
      must_change_password
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(a.uid).first();

  if(!user || !user.password_hash || !user.password_salt){
    return json(404, "not_found", { message:"user_or_password_not_found" });
  }

  const iter = Math.min(200000, Number(user.password_iter || 100000));
  const calc = await pbkdf2Hash(current_password, user.password_salt, iter);

  if(!timingSafeEqual(calc, user.password_hash)){
    return json(403, "password_invalid", { message:"current_password_invalid" });
  }

  const newSalt = randomB64(16);
  const newIter = 100000;
  const newHash = await pbkdf2Hash(new_password, newSalt, newIter);
  const nextSessionVersion = Number(user.session_version || 1) + 1;
  const now = nowSec();

  await env.DB.prepare(`
    UPDATE users
    SET
      password_hash = ?,
      password_salt = ?,
      password_iter = ?,
      password_algo = ?,
      must_change_password = 0,
      pw_fail_count = 0,
      pw_fail_last_at = NULL,
      locked_until = NULL,
      lock_reason = NULL,
      session_version = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(
    newHash,
    newSalt,
    newIter,
    "pbkdf2_sha256",
    nextSessionVersion,
    now,
    a.uid
  ).run();

  if(revoke_others){
    await env.DB.prepare(`
      UPDATE sessions
      SET revoked_at = ?, revoke_reason = ?
      WHERE user_id = ? AND revoked_at IS NULL AND id <> ?
    `).bind(now, "password_changed", a.uid, a.sid).run();
  }

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "password_changed_required",
      ip_hash: ipHash,
      http_status: 200,
      meta: {
        revoke_others,
        old_must_change_password: Number(user.must_change_password || 0) === 1,
        new_session_version: nextSessionVersion
      }
    });
  }catch{}

  return json(200, "ok", {
    changed: true,
    must_change_password: false,
    new_session_version: nextSessionVersion,
    revoke_others
  });
}

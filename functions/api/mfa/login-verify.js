import {
  json, readJson, createSession, auditEvent, sha256Base64
} from "../../_lib.js";
import {
  verifyPendingLoginToken, verifyTotp, safeJsonArray
} from "./_common.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const body = await readJson(request) || {};
  const pending_token = String(body.pending_token || "").trim();
  const code = String(body.code || "").trim();

  if(!pending_token || !code){
    return json(400, "invalid_input", { message:"pending_token_and_code_required" });
  }

  const pending = await verifyPendingLoginToken(env, pending_token);
  if(!pending){
    return json(403, "forbidden", { message:"invalid_or_expired_pending_token" });
  }

  const user = await env.DB.prepare(`
    SELECT
      id, email_norm, display_name, status,
      session_version, must_change_password,
      mfa_enabled, mfa_type, mfa_secret, recovery_codes_json
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(pending.uid).first();

  if(!user || String(user.status || "").toLowerCase() !== "active"){
    return json(403, "forbidden", { message:"user_not_active" });
  }

  if(Number(user.mfa_enabled || 0) !== 1 || !user.mfa_secret){
    return json(403, "forbidden", { message:"mfa_not_enabled" });
  }

  let verified = await verifyTotp(String(user.mfa_secret || ""), code, { window: 1 });
  let used_recovery_code = false;

  if(!verified){
    const rawCodes = safeJsonArray(user.recovery_codes_json);
    const codeHash = await sha256Base64(code);
    if(rawCodes.includes(codeHash)){
      verified = true;
      used_recovery_code = true;
      const nextCodes = rawCodes.filter(x => String(x) !== String(codeHash));
      await env.DB.prepare(`
        UPDATE users
        SET recovery_codes_json = ?, updated_at = strftime('%s','now')
        WHERE id = ?
      `).bind(JSON.stringify(nextCodes), user.id).run();
    }
  }

  if(!verified){
    return json(400, "invalid_input", { message:"invalid_mfa_code" });
  }

  const sessionVersion = Number(user.session_version || 1);
  const sess = await createSession(env, user.id, pending.roles || [], {
    ip_hash: pending.ip_hash || null,
    ua_hash: pending.ua_hash || null,
    session_version: sessionVersion
  });

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: user.id,
      action: used_recovery_code ? "mfa_login_recovery_verified" : "mfa_login_verified",
      ip_hash: ipHash || pending.ip_hash || null,
      ua_hash: pending.ua_hash || null,
      http_status: 200,
      meta: {
        used_recovery_code,
        session_version: sessionVersion
      }
    });
  }catch{}

  const res = json(200, "ok", {
    logged_in: true,
    used_recovery_code,
    id: user.id,
    email_norm: user.email_norm,
    display_name: user.display_name,
    roles: pending.roles || [],
    must_change_password: Number(user.must_change_password || 0) === 1,
    mfa_enabled: true,
    exp: sess.exp
  });

  res.headers.append("set-cookie", `sid=${sess.sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sess.ttl}`);
  return res;
}

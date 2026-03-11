import {
  json, nowSec, sha256Base64, pbkdf2Hash, timingSafeEqual, auditEvent
} from "../../../_lib.js";

function getClientIp(request){
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

async function hashUa(request){
  return await sha256Base64(request.headers.get("user-agent") || "");
}

async function hashIdentifier(v){
  return await sha256Base64(String(v || ""));
}

/**
 * verifyOtpByIdentifier(env, request, { purpose, identifier, otp })
 *
 * identifier = email / phone / user key yang sama dengan identifier_hash waktu create OTP
 */
export async function verifyOtpByIdentifier(env, request, {
  purpose,
  identifier,
  otp,
  actor_user_id = null
}){
  const now = nowSec();
  const ipHash = await hashIp(env, getClientIp(request));
  const uaHash = await hashUa(request);
  const identifierHash = await hashIdentifier(identifier);

  const row = await env.DB.prepare(`
    SELECT
      id, purpose, identifier_hash, otp_hash, otp_salt,
      attempts, max_attempts, created_at, expires_at, consumed_at
    FROM otp_requests
    WHERE purpose=? AND identifier_hash=?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(String(purpose || ""), identifierHash).first();

  if(!row){
    await auditEvent(env, request, {
      actor_user_id,
      actor_identifier_hash: identifierHash,
      action: "otp_verify_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 404,
      meta: { reason: "otp_request_not_found", purpose }
    });
    return json(404, "not_found", { message:"otp_request_not_found" });
  }

  if(row.consumed_at){
    await auditEvent(env, request, {
      actor_user_id,
      actor_identifier_hash: identifierHash,
      action: "otp_verify_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 409,
      meta: { reason: "otp_already_consumed", purpose, otp_request_id: row.id }
    });
    return json(409, "conflict", { message:"otp_already_consumed" });
  }

  if(now > Number(row.expires_at || 0)){
    await auditEvent(env, request, {
      actor_user_id,
      actor_identifier_hash: identifierHash,
      action: "otp_verify_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 410,
      meta: { reason: "otp_expired", purpose, otp_request_id: row.id }
    });
    return json(410, "expired", { message:"otp_expired" });
  }

  const attempts = Number(row.attempts || 0);
  const maxAttempts = Number(row.max_attempts || 5);

  if(attempts >= maxAttempts){
    await auditEvent(env, request, {
      actor_user_id,
      actor_identifier_hash: identifierHash,
      action: "lockout",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 403,
      meta: { reason: "otp_attempts_exhausted", purpose, otp_request_id: row.id }
    });
    return json(403, "forbidden", { message:"otp_locked" });
  }

  const calc = await pbkdf2Hash(String(otp || ""), row.otp_salt, 100000);
  const ok = timingSafeEqual(calc, row.otp_hash);

  if(!ok){
    const newAttempts = attempts + 1;
    await env.DB.prepare(`
      UPDATE otp_requests
      SET attempts=?
      WHERE id=?
    `).bind(newAttempts, row.id).run();

    await auditEvent(env, request, {
      actor_user_id,
      actor_identifier_hash: identifierHash,
      action: "otp_verify_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 403,
      meta: {
        reason: "otp_invalid",
        purpose,
        otp_request_id: row.id,
        attempts: newAttempts,
        max_attempts: maxAttempts
      }
    });

    if(newAttempts >= maxAttempts){
      await auditEvent(env, request, {
        actor_user_id,
        actor_identifier_hash: identifierHash,
        action: "lockout",
        ip_hash: ipHash,
        ua_hash: uaHash,
        http_status: 403,
        meta: {
          reason: "otp_attempts_exhausted",
          purpose,
          otp_request_id: row.id
        }
      });
    }

    return json(403, "otp_invalid", { message:"otp_invalid", attempts: newAttempts, max_attempts: maxAttempts });
  }

  await env.DB.prepare(`
    UPDATE otp_requests
    SET consumed_at=?
    WHERE id=?
  `).bind(now, row.id).run();

  await auditEvent(env, request, {
    actor_user_id,
    actor_identifier_hash: identifierHash,
    action: "otp_verify_ok",
    ip_hash: ipHash,
    ua_hash: uaHash,
    http_status: 200,
    meta: {
      purpose,
      otp_request_id: row.id
    }
  });

  return json(200, "ok", {
    verified: true,
    otp_request_id: row.id,
    purpose
  });
}

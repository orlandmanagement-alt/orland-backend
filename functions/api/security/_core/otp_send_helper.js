import {
  json, nowSec, randomB64, pbkdf2Hash, sha256Base64, auditEvent
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

function generateOtp(length=6){
  let out = "";
  for(let i=0;i<length;i++){
    out += String(Math.floor(Math.random() * 10));
  }
  return out;
}

/**
 * createOtpRequest(env, request, {
 *   purpose,
 *   identifier,
 *   actor_user_id,
 *   ttl_sec,
 *   max_attempts,
 *   otp_length
 * })
 *
 * Returns:
 * {
 *   ok:true,
 *   otp_plain,
 *   otp_request_id,
 *   identifier_hash,
 *   expires_at
 * }
 */
export async function createOtpRequest(env, request, {
  purpose,
  identifier,
  actor_user_id = null,
  ttl_sec = 300,
  max_attempts = 5,
  otp_length = 6
}){
  const now = nowSec();
  const ipHash = await hashIp(env, getClientIp(request));
  const uaHash = await hashUa(request);
  const identifierHash = await hashIdentifier(identifier);

  try{
    const otpPlain = generateOtp(otp_length);
    const otpSalt = randomB64(16);
    const otpHash = await pbkdf2Hash(otpPlain, otpSalt, 100000);
    const expiresAt = now + Math.max(60, Number(ttl_sec || 300));
    const id = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO otp_requests (
        id, purpose, identifier_hash, otp_hash, otp_salt,
        attempts, max_attempts, created_at, expires_at, consumed_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id,
      String(purpose || ""),
      identifierHash,
      otpHash,
      otpSalt,
      0,
      Math.max(1, Number(max_attempts || 5)),
      now,
      expiresAt,
      null
    ).run();

    await auditEvent(env, request, {
      actor_user_id,
      actor_identifier_hash: identifierHash,
      action: "otp_send_ok",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 200,
      meta: {
        purpose,
        otp_request_id: id,
        ttl_sec: Number(ttl_sec || 300)
      }
    });

    return {
      ok: true,
      otp_plain: otpPlain,
      otp_request_id: id,
      identifier_hash: identifierHash,
      expires_at: expiresAt
    };
  }catch(err){
    await auditEvent(env, request, {
      actor_user_id,
      actor_identifier_hash: identifierHash,
      action: "otp_send_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 500,
      meta: {
        purpose,
        message: String(err?.message || err || "otp_send_failed")
      }
    });

    return {
      ok: false,
      error: String(err?.message || err || "otp_send_failed")
    };
  }
}

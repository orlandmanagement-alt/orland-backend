import {
  json,
  readJson,
  nowSec,
  sha256Base64,
  auditEvent,
  requireEnv
} from "../../_lib.js";

function getClientIp(request){
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

function getUa(request){
  return request.headers.get("user-agent") || "";
}

async function sha(v){
  return await sha256Base64(String(v || ""));
}

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

function randomDigits(len = 6){
  let out = "";
  const arr = crypto.getRandomValues(new Uint8Array(len));
  for(let i = 0; i < len; i++){
    out += String(arr[i] % 10);
  }
  return out;
}

export async function onRequestPost({ request, env }){
  const started = Date.now();
  const miss = requireEnv(env, ["HASH_PEPPER"]);
  if(miss.length){
    return json(500, "server_error", { message: "missing_env", missing: miss });
  }

  const body = await readJson(request) || {};
  const challengeId = String(body.challenge_id || "").trim();

  if(!challengeId){
    return json(400, "invalid_input", { message: "challenge_id_required" });
  }

  const ip = getClientIp(request);
  const ua = getUa(request);
  const ipHash = await hashIp(env, ip);
  const uaHash = await sha(ua);
  const now = nowSec();

  const row = await env.DB.prepare(`
    SELECT
      id,
      user_id,
      identity_type,
      identity_value,
      status
    FROM sso_login_challenges
    WHERE id = ?
    LIMIT 1
  `).bind(challengeId).first();

  if(!row){
    return json(404, "not_found", { message: "challenge_not_found" });
  }

  const ttlSec = Math.max(60, Number(env.SSO_OTP_TTL_SEC || 300));
  const expiresAt = now + ttlSec;
  const newCode = randomDigits(6);
  const newId = crypto.randomUUID();

  await env.DB.prepare(`
    UPDATE sso_login_challenges
    SET status = 'expired'
    WHERE id = ?
      AND status = 'pending'
  `).bind(challengeId).run();

  await env.DB.prepare(`
    INSERT INTO sso_login_challenges (
      id, user_id, identity_type, identity_value, otp_code, status,
      ip_hash, ua_hash, expires_at, created_at, consumed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    newId,
    row.user_id,
    row.identity_type,
    row.identity_value,
    newCode,
    "pending",
    ipHash,
    uaHash,
    expiresAt,
    now,
    null
  ).run();

  await env.DB.prepare(`
    INSERT INTO sso_login_events (
      id, user_id, identity_type, identity_value, flow, result,
      ip_hash, ua_hash, meta_json, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(),
    row.user_id,
    row.identity_type,
    row.identity_value,
    "request_login_challenge_resend",
    "otp_resent",
    ipHash,
    uaHash,
    JSON.stringify({
      old_challenge_id: challengeId,
      new_challenge_id: newId,
      expires_at: expiresAt
    }),
    now
  ).run();

  await auditEvent(env, request, {
    actor_user_id: row.user_id,
    action: "sso_request_login_challenge_resend",
    ip_hash: ipHash,
    ua_hash: uaHash,
    http_status: 200,
    duration_ms: Date.now() - started,
    meta: {
      old_challenge_id: challengeId,
      new_challenge_id: newId,
      expires_at: expiresAt
    }
  });

  return json(200, "ok", {
    resent: true,
    challenge_id: newId,
    expires_at: expiresAt,
    otp_debug: newCode
  });
}

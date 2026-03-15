import {
  json,
  readJson,
  normEmail,
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

function normalizePhone(v){
  const s = String(v || "").replace(/[^\d]/g, "");
  if(!s) return "";
  if(s.startsWith("62")) return s;
  if(s.startsWith("08")) return "62" + s.slice(1);
  return s;
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
  if(miss.length) return json(500, "server_error", { message: "missing_env", missing: miss });

  const body = await readJson(request) || {};
  const email = normEmail(body.email);
  const phone = normalizePhone(body.phone);

  if(!email && !phone){
    return json(400, "invalid_input", { message: "email_or_phone_required" });
  }

  const identityType = email ? "email" : "phone";
  const identityValue = email || phone;

  const ip = getClientIp(request);
  const ua = getUa(request);
  const ipHash = await hashIp(env, ip);
  const uaHash = await sha(ua);
  const actorIdentifierHash = await sha(identityValue);

  let user = null;
  if(identityType === "email"){
    user = await env.DB.prepare(`
      SELECT id, email_norm, display_name, status, disabled_at
      FROM users
      WHERE email_norm = ?
      LIMIT 1
    `).bind(email).first();
  } else {
    user = await env.DB.prepare(`
      SELECT id, email_norm, display_name, status, disabled_at
      FROM users
      WHERE phone_e164 = ?
      LIMIT 1
    `).bind(phone).first();
  }

  if(!user){
    await env.DB.prepare(`
      INSERT INTO sso_login_events (
        id, user_id, identity_type, identity_value, flow, result,
        ip_hash, ua_hash, meta_json, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).bind(
      crypto.randomUUID(),
      null,
      identityType,
      identityValue,
      "request_login_challenge",
      "user_not_found",
      ipHash,
      uaHash,
      JSON.stringify({ reason: "user_not_found" }),
      nowSec()
    ).run();

    await auditEvent(env, request, {
      actor_identifier_hash: actorIdentifierHash,
      action: "sso_request_login_challenge_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 404,
      duration_ms: Date.now() - started,
      meta: { identity_type: identityType, reason: "user_not_found" }
    });

    return json(404, "not_found", { message: "user_not_found" });
  }

  if(String(user.status || "").toLowerCase() !== "active" || user.disabled_at != null){
    return json(403, "forbidden", { message: "user_inactive" });
  }

  const ttlSec = Math.max(60, Number(env.SSO_OTP_TTL_SEC || 300));
  const now = nowSec();
  const expiresAt = now + ttlSec;
  const code = randomDigits(6);
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    UPDATE sso_login_challenges
    SET status = 'expired'
    WHERE identity_type = ?
      AND identity_value = ?
      AND status = 'pending'
      AND expires_at < ?
  `).bind(identityType, identityValue, now).run();

  await env.DB.prepare(`
    INSERT INTO sso_login_challenges (
      id, user_id, identity_type, identity_value, otp_code, status,
      ip_hash, ua_hash, expires_at, created_at, consumed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    user.id,
    identityType,
    identityValue,
    code,
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
    user.id,
    identityType,
    identityValue,
    "request_login_challenge",
    "otp_issued",
    ipHash,
    uaHash,
    JSON.stringify({ challenge_id: id, expires_at: expiresAt }),
    now
  ).run();

  await auditEvent(env, request, {
    actor_user_id: user.id,
    actor_identifier_hash: actorIdentifierHash,
    action: "sso_request_login_challenge",
    ip_hash: ipHash,
    ua_hash: uaHash,
    http_status: 200,
    duration_ms: Date.now() - started,
    meta: {
      challenge_id: id,
      identity_type: identityType,
      expires_at: expiresAt,
      delivery: "debug_response"
    }
  });

  return json(200, "ok", {
    challenge_id: id,
    identity_type: identityType,
    identity_value: identityValue,
    expires_at: expiresAt,
    otp_debug: code
  });
}

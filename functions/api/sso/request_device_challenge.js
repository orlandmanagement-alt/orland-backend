import {
  json,
  requireAuth,
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

  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  const now = nowSec();
  const ttlSec = Math.max(60, Number(env.SSO_STEPUP_TTL_SEC || 300));
  const expiresAt = now + ttlSec;
  const code = randomDigits(6);

  const ip = getClientIp(request);
  const ua = getUa(request);
  const ipHash = await hashIp(env, ip);
  const uaHash = await sha(ua);

  await env.DB.prepare(`
    UPDATE sso_step_up_challenges
    SET status = 'expired'
    WHERE user_id = ?
      AND action_code = 'device_verify'
      AND status = 'pending'
      AND expires_at < ?
  `).bind(auth.uid, now).run();

  const existing = await env.DB.prepare(`
    SELECT id
    FROM sso_step_up_challenges
    WHERE user_id = ?
      AND action_code = 'device_verify'
      AND status = 'pending'
      AND expires_at >= ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(auth.uid, now).first();

  if(existing){
    await env.DB.prepare(`
      UPDATE sso_step_up_challenges
      SET
        otp_code = ?,
        ip_hash = ?,
        ua_hash = ?,
        expires_at = ?,
        created_at = ?
      WHERE id = ?
    `).bind(
      code,
      ipHash,
      uaHash,
      expiresAt,
      now,
      existing.id
    ).run();

    await auditEvent(env, request, {
      actor_user_id: auth.uid,
      action: "sso_request_device_challenge_refresh",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 200,
      duration_ms: Date.now() - started,
      meta: {
        challenge_id: existing.id,
        expires_at: expiresAt
      }
    });

    return json(200, "ok", {
      challenge_id: existing.id,
      expires_at: expiresAt,
      otp_debug: code
    });
  }

  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO sso_step_up_challenges (
      id,
      user_id,
      action_code,
      otp_code,
      status,
      ip_hash,
      ua_hash,
      expires_at,
      created_at,
      consumed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    auth.uid,
    "device_verify",
    code,
    "pending",
    ipHash,
    uaHash,
    expiresAt,
    now,
    null
  ).run();

  await auditEvent(env, request, {
    actor_user_id: auth.uid,
    action: "sso_request_device_challenge",
    ip_hash: ipHash,
    ua_hash: uaHash,
    http_status: 200,
    duration_ms: Date.now() - started,
    meta: {
      challenge_id: id,
      expires_at: expiresAt
    }
  });

  return json(200, "ok", {
    challenge_id: id,
    expires_at: expiresAt,
    otp_debug: code
  });
}

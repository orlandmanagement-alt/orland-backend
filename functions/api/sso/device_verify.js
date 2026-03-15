import {
  json,
  readJson,
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

async function computeDeviceHash(env, request, userId){
  const ua = getUa(request);
  const ip = getClientIp(request);
  const raw = `${userId}|${ua}|${ip}|${env.HASH_PEPPER || ""}`;
  return await sha256Base64(raw);
}

export async function onRequestPost({ request, env }){
  const started = Date.now();
  const miss = requireEnv(env, ["HASH_PEPPER"]);
  if(miss.length){
    return json(500, "server_error", { message: "missing_env", missing: miss });
  }

  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  const body = await readJson(request) || {};
  const otpCode = String(body.otp_code || "").trim();

  if(!otpCode){
    return json(400, "invalid_input", { message: "otp_code_required" });
  }

  const now = nowSec();
  const ip = getClientIp(request);
  const ua = getUa(request);
  const ipHash = await hashIp(env, ip);
  const uaHash = await sha(ua);
  const deviceHash = await computeDeviceHash(env, request, auth.uid);

  const challenge = await env.DB.prepare(`
    SELECT
      id,
      user_id,
      otp_code,
      status,
      expires_at
    FROM sso_step_up_challenges
    WHERE user_id = ?
      AND action_code = 'device_verify'
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(auth.uid).first();

  if(!challenge){
    return json(404, "not_found", { message: "device_challenge_not_found" });
  }

  if(Number(challenge.expires_at || 0) < now){
    await env.DB.prepare(`
      UPDATE sso_step_up_challenges
      SET status = 'expired'
      WHERE id = ?
    `).bind(challenge.id).run();

    return json(403, "forbidden", { message: "device_challenge_expired" });
  }

  if(String(challenge.otp_code || "") !== otpCode){
    await auditEvent(env, request, {
      actor_user_id: auth.uid,
      action: "sso_device_verify_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 403,
      duration_ms: Date.now() - started,
      meta: { reason: "invalid_otp" }
    });
    return json(403, "forbidden", { message: "invalid_otp_code" });
  }

  await env.DB.prepare(`
    UPDATE sso_step_up_challenges
    SET status = 'consumed', consumed_at = ?
    WHERE id = ?
  `).bind(now, challenge.id).run();

  const existing = await env.DB.prepare(`
    SELECT id
    FROM sso_trusted_devices
    WHERE user_id = ?
      AND device_hash = ?
    LIMIT 1
  `).bind(auth.uid, deviceHash).first();

  if(existing){
    await env.DB.prepare(`
      UPDATE sso_trusted_devices
      SET
        status = 'active',
        last_ip_hash = ?,
        last_ua_hash = ?,
        last_seen_at = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(ipHash, uaHash, now, now, existing.id).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO sso_trusted_devices (
        id, user_id, device_hash, device_name, status,
        first_ip_hash, last_ip_hash, first_ua_hash, last_ua_hash,
        last_seen_at, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      crypto.randomUUID(),
      auth.uid,
      deviceHash,
      "Verified Device",
      "active",
      ipHash,
      ipHash,
      uaHash,
      uaHash,
      now,
      now,
      now
    ).run();
  }

  await auditEvent(env, request, {
    actor_user_id: auth.uid,
    action: "sso_device_verify_success",
    ip_hash: ipHash,
    ua_hash: uaHash,
    http_status: 200,
    duration_ms: Date.now() - started,
    meta: { device_hash: deviceHash }
  });

  return json(200, "ok", {
    verified: true,
    next: "/app/pages/sso/session-check.html"
  });
}

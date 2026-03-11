import { json, readJson, requireAuth, nowSec, sha256Base64 } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const otp = String(body.otp || "").trim();

  if(!otp || otp.length < 4){
    return json(400, "invalid_input", { message: "otp_required" });
  }

  const user = await env.DB.prepare(`
    SELECT phone_e164
    FROM users
    WHERE id=?
    LIMIT 1
  `).bind(a.user.id).first();

  const phone = String(user?.phone_e164 || "").trim();
  if(!phone){
    return json(400, "invalid_input", { message: "phone_not_set" });
  }

  const now = nowSec();
  const identifier_hash = await sha256Base64("phone|" + phone + "|" + String(env.HASH_PEPPER || ""));

  const req = await env.DB.prepare(`
    SELECT id, otp_hash, otp_salt, attempts, max_attempts, expires_at, consumed_at
    FROM otp_requests
    WHERE purpose='verify_phone'
      AND identifier_hash=?
      AND consumed_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(identifier_hash).first();

  if(!req){
    return json(400, "invalid_input", { message: "otp_request_not_found" });
  }

  if(Number(req.expires_at || 0) < now){
    return json(400, "invalid_input", { message: "otp_expired" });
  }

  const attempts = Number(req.attempts || 0);
  const maxAttempts = Number(req.max_attempts || 5);
  if(attempts >= maxAttempts){
    return json(400, "invalid_input", { message: "otp_max_attempts_reached" });
  }

  const otp_hash = await sha256Base64(otp + "|" + String(req.otp_salt || "") + "|" + String(env.HASH_PEPPER || ""));
  if(otp_hash !== String(req.otp_hash || "")){
    await env.DB.prepare(`
      UPDATE otp_requests
      SET attempts=attempts+1
      WHERE id=?
    `).bind(req.id).run();

    return json(400, "invalid_input", { message: "otp_invalid" });
  }

  await env.DB.prepare(`
    UPDATE otp_requests
    SET consumed_at=?
    WHERE id=?
  `).bind(now, req.id).run();

  await env.DB.prepare(`
    UPDATE users
    SET phone_verified=1,
        phone_verified_at=?,
        updated_at=?
    WHERE id=?
  `).bind(now, now, a.user.id).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    a.user.id,
    "verification_phone_completed",
    "user",
    a.user.id,
    JSON.stringify({ phone_e164: phone }),
    now
  ).run();

  return json(200, "ok", {
    verified: true,
    channel: "sms_wa"
  });
}

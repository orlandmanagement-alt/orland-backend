import { json, requireAuth, nowSec, sha256Base64 } from "../../_lib.js";

function randOtp(){
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

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
  const otp = randOtp();
  const salt = crypto.randomUUID();
  const identifier_hash = await sha256Base64("phone|" + phone + "|" + String(env.HASH_PEPPER || ""));
  const otp_hash = await sha256Base64(otp + "|" + salt + "|" + String(env.HASH_PEPPER || ""));

  await env.DB.prepare(`
    INSERT INTO otp_requests (
      id, purpose, identifier_hash, otp_hash, otp_salt, attempts, max_attempts, created_at, expires_at, consumed_at
    ) VALUES (?, ?, ?, ?, ?, 0, 5, ?, ?, NULL)
  `).bind(
    crypto.randomUUID(),
    "verify_phone",
    identifier_hash,
    otp_hash,
    salt,
    now,
    now + 600
  ).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    a.user.id,
    "verification_phone_otp_requested",
    "user",
    a.user.id,
    JSON.stringify({
      phone_e164: phone,
      mode: "internal_otp_v1"
    }),
    now
  ).run();

  return json(200, "ok", {
    sent: true,
    channel: "sms_wa",
    mode: "internal_otp_v1",
    expires_in_sec: 600,
    dev_otp: otp
  });
}

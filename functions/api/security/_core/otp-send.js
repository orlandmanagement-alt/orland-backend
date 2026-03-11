import { json, readJson, requireAuth, hasRole } from "../../../_lib.js";
import { createOtpRequest } from "./otp_send_helper.js";

/**
 * Generic OTP send endpoint
 * POST /api/security/otp-send
 * body:
 * {
 *   "purpose": "login_2fa",
 *   "identifier": "user@example.com",
 *   "channel": "debug",
 *   "ttl_sec": 300,
 *   "max_attempts": 5
 * }
 *
 * channel:
 * - "debug" => return OTP in response (for development only)
 * - "silent" => do not return OTP
 *
 * Nanti bisa disambungkan ke email/wa/sms sender.
 */
export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const purpose = String(body.purpose || "").trim();
  const identifier = String(body.identifier || "").trim();
  const channel = String(body.channel || "silent").trim();
  const ttl_sec = Number(body.ttl_sec || 300);
  const max_attempts = Number(body.max_attempts || 5);

  if(!purpose || !identifier){
    return json(400, "invalid_input", { message:"purpose_identifier_required" });
  }

  const created = await createOtpRequest(env, request, {
    purpose,
    identifier,
    actor_user_id: a.uid,
    ttl_sec,
    max_attempts,
    otp_length: 6
  });

  if(!created.ok){
    return json(500, "server_error", { message: created.error || "otp_send_failed" });
  }

  return json(200, "ok", {
    sent: true,
    purpose,
    identifier,
    otp_request_id: created.otp_request_id,
    expires_at: created.expires_at,
    otp: channel === "debug" ? created.otp_plain : undefined
  });
}

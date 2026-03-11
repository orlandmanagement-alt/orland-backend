import { json, readJson, requireAuth, hasRole } from "../../../_lib.js";
import { verifyOtpByIdentifier } from "./otp_verify_helper.js";

/**
 * Generic OTP verify endpoint
 * POST /api/security/otp-verify
 * body:
 * {
 *   "purpose": "login_2fa",
 *   "identifier": "user@example.com",
 *   "otp": "123456"
 * }
 */
export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  // role check bisa dilonggarkan kalau endpoint ini untuk public flow
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const purpose = String(body.purpose || "").trim();
  const identifier = String(body.identifier || "").trim();
  const otp = String(body.otp || "").trim();

  if(!purpose || !identifier || !otp){
    return json(400, "invalid_input", { message:"purpose_identifier_otp_required" });
  }

  return await verifyOtpByIdentifier(env, request, {
    purpose,
    identifier,
    otp,
    actor_user_id: a.uid
  });
}

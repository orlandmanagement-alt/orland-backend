import { json, requireAuth, randomB64, nowSec } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const user = await env.DB.prepare(`
    SELECT id, email_norm, display_name, mfa_enabled, mfa_type
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(a.uid).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  if(Number(user.mfa_enabled || 0) !== 1){
    return json(400, "invalid_input", { message:"mfa_not_enabled" });
  }

  const challenge_id = crypto.randomUUID();
  const challenge_token = randomB64(18);
  const expires_at = nowSec() + 300;

  return json(200, "ok", {
    challenge_id,
    challenge_token,
    expires_at,
    method: user.mfa_type || "app"
  });
}

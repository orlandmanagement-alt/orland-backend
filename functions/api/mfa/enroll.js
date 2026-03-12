import { json, requireAuth } from "../../_lib.js";
import { readMfaPolicy, generateBase32Secret, otpauthUrl } from "./_common.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const policy = await readMfaPolicy(env);
  if(Number(policy.enabled || 0) !== 1){
    return json(400, "invalid_input", { message:"mfa_policy_disabled" });
  }

  if(Number(policy.allow_user_opt_in || 0) !== 1){
    return json(403, "forbidden", { message:"user_mfa_opt_in_disabled" });
  }

  const user = await env.DB.prepare(`
    SELECT id, email_norm, display_name, mfa_enabled, mfa_type
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(a.uid).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  const secret = generateBase32Secret(20);
  const issuer = String(env.MFA_ISSUER || "ORLAND");
  const account = String(user.email_norm || user.id || "user");
  const provision_url = otpauthUrl({ issuer, account, secret });

  await env.DB.prepare(`
    UPDATE users
    SET
      mfa_secret = ?,
      mfa_enabled = 0,
      mfa_type = 'app',
      updated_at = strftime('%s','now')
    WHERE id = ?
  `).bind(secret, a.uid).run();

  return json(200, "ok", {
    enrollment_ready: true,
    user: {
      id: String(user.id || ""),
      email_norm: user.email_norm || null,
      display_name: user.display_name || null,
      mfa_enabled: Number(user.mfa_enabled || 0) === 1,
      mfa_type: user.mfa_type || null
    },
    secret,
    provision_url,
    issuer
  });
}

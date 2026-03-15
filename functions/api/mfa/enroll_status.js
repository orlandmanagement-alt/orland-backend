import { json, requireAuth } from "../../_lib.js";
import {
  generateBase32Secret,
  otpauthUrl
} from "./_common.js";

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  const user = auth.user || {};
  const requireEnroll = Number(user.require_mfa_enroll || 0) === 1;
  const hasMfa = Number(user.mfa_enabled || 0) === 1 && !!user.mfa_type;

  if(hasMfa && !requireEnroll){
    return json(200, "ok", {
      enrolled: true,
      require_mfa_enroll: false,
      mfa_enabled: true,
      mfa_type: user.mfa_type || "app"
    });
  }

  let secret = null;
  let qr_url = null;

  try{
    const row = await env.DB.prepare(`
      SELECT mfa_secret, email_norm
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(auth.uid).first();

    secret = String(row?.mfa_secret || "").trim();

    if(!secret){
      secret = generateBase32Secret(20);
      await env.DB.prepare(`
        UPDATE users
        SET mfa_secret = ?
        WHERE id = ?
      `).bind(secret, auth.uid).run();
    }

    qr_url = otpauthUrl({
      issuer: String(env.MFA_ISSUER || "OrlandManagement"),
      account: String(row?.email_norm || user.email_norm || auth.uid),
      secret
    });

    return json(200, "ok", {
      enrolled: hasMfa,
      require_mfa_enroll: requireEnroll,
      mfa_enabled: Number(user.mfa_enabled || 0) === 1,
      mfa_type: user.mfa_type || null,
      secret,
      qr_url
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_mfa_enroll_status",
      detail: String(err?.message || err)
    });
  }
}

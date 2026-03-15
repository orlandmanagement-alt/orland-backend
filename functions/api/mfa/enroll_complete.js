import { json, requireAuth, nowSec, auditEvent } from "../../_lib.js";
import {
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCodes
} from "./_common.js";

async function readJsonSafe(request){
  try{
    return await request.json();
  }catch{
    return {};
  }
}

export async function onRequestPost({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  const body = await readJsonSafe(request);
  const code = String(body.code || "").trim();

  if(!/^\d{6,8}$/.test(code)){
    return json(400, "invalid_input", { message: "invalid_totp_code" });
  }

  try{
    const row = await env.DB.prepare(`
      SELECT id, email_norm, mfa_secret
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(auth.uid).first();

    if(!row?.mfa_secret){
      return json(400, "invalid_state", { message: "mfa_secret_not_initialized" });
    }

    const ok = await verifyTotp(row.mfa_secret, code, {
      digits: 6,
      step: 30,
      window: 1
    });

    if(!ok){
      return json(403, "forbidden", { message: "invalid_totp_code" });
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryCodesHashed = await hashRecoveryCodes(recoveryCodes);

    await env.DB.prepare(`
      UPDATE users
      SET
        mfa_enabled = 1,
        mfa_type = 'app',
        require_mfa_enroll = 0,
        recovery_codes_json = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(JSON.stringify(recoveryCodesHashed), nowSec(), auth.uid).run();

    await auditEvent(env, request, {
      actor_user_id: auth.uid,
      action: "mfa_enroll_complete",
      target_type: "user",
      target_id: auth.uid,
      http_status: 200,
      meta: { recovery_codes_count: recoveryCodes.length }
    });

    return json(200, "ok", {
      enrolled: true,
      mfa_enabled: true,
      mfa_type: "app",
      recovery_codes: recoveryCodes
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_complete_mfa_enroll",
      detail: String(err?.message || err)
    });
  }
}

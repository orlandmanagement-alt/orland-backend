import { json, readJson, requireAuth, sha256Base64 } from "../../_lib.js";
import { verifyTotp, safeJsonArray } from "./_common.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const code = String(body.code || "").trim();
  const challenge_id = String(body.challenge_id || "").trim();

  if(!challenge_id || !code){
    return json(400, "invalid_input", { message:"challenge_id_and_code_required" });
  }

  const user = await env.DB.prepare(`
    SELECT id, mfa_enabled, mfa_secret, recovery_codes_json
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(a.uid).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  if(Number(user.mfa_enabled || 0) !== 1 || !user.mfa_secret){
    return json(400, "invalid_input", { message:"mfa_not_enabled" });
  }

  let verified = await verifyTotp(String(user.mfa_secret || ""), code, { window: 1 });
  let used_recovery_code = false;

  if(!verified){
    const raw = safeJsonArray(user.recovery_codes_json);
    const codeHash = await sha256Base64(code);
    if(raw.includes(codeHash)){
      verified = true;
      used_recovery_code = true;
      const next = raw.filter(x => String(x) !== String(codeHash));
      await env.DB.prepare(`
        UPDATE users
        SET recovery_codes_json = ?, updated_at = strftime('%s','now')
        WHERE id = ?
      `).bind(JSON.stringify(next), a.uid).run();
    }
  }

  if(!verified){
    return json(400, "invalid_input", { message:"invalid_mfa_code" });
  }

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  return json(200, "ok", {
    verified: true,
    used_recovery_code,
    challenge_id
  });
}

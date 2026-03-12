import { json, readJson, requireAuth, auditEvent, sha256Base64 } from "../../_lib.js";
import { verifyTotp } from "./_common.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const code = String(body.code || "").trim();

  if(!code){
    return json(400, "invalid_input", { message:"code_required" });
  }

  const user = await env.DB.prepare(`
    SELECT id, mfa_secret, mfa_enabled, mfa_type
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(a.uid).first();

  if(!user || !user.mfa_secret){
    return json(404, "not_found", { message:"pending_mfa_secret_not_found" });
  }

  const ok = await verifyTotp(String(user.mfa_secret || ""), code, { window: 1 });
  if(!ok){
    return json(400, "invalid_input", { message:"invalid_verification_code" });
  }

  await env.DB.prepare(`
    UPDATE users
    SET
      mfa_enabled = 1,
      mfa_type = 'app',
      updated_at = strftime('%s','now')
    WHERE id = ?
  `).bind(a.uid).run();

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "mfa_enroll_verified",
      ip_hash: ipHash,
      http_status: 200,
      meta: { method: "app" }
    });
  }catch{}

  return json(200, "ok", {
    enrolled: true,
    mfa_enabled: true,
    mfa_type: "app"
  });
}

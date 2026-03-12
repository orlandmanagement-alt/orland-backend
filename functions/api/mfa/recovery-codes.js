import { json, readJson, requireAuth, auditEvent, sha256Base64 } from "../../_lib.js";
import { safeJsonArray, generateRecoveryCodes, hashRecoveryCodes } from "./_common.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const user = await env.DB.prepare(`
    SELECT id, mfa_enabled, recovery_codes_json
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(a.uid).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  const current = safeJsonArray(user.recovery_codes_json);

  return json(200, "ok", {
    mfa_enabled: Number(user.mfa_enabled || 0) === 1,
    recovery_codes_count: current.length
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const action = String(body.action || "generate").trim().toLowerCase();

  const user = await env.DB.prepare(`
    SELECT id, mfa_enabled
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

  if(action !== "generate"){
    return json(400, "invalid_input", { message:"invalid_action" });
  }

  const plainCodes = generateRecoveryCodes();
  const hashedCodes = await hashRecoveryCodes(plainCodes);

  await env.DB.prepare(`
    UPDATE users
    SET recovery_codes_json = ?, updated_at = strftime('%s','now')
    WHERE id = ?
  `).bind(JSON.stringify(hashedCodes), a.uid).run();

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await sha256Base64(String(ip || "") + "|" + String(env.HASH_PEPPER || ""));
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "recovery_codes_generated",
      ip_hash: ipHash,
      http_status: 200,
      meta: { count: plainCodes.length }
    });
  }catch{}

  return json(200, "ok", {
    generated: true,
    codes: plainCodes,
    count: plainCodes.length
  });
}

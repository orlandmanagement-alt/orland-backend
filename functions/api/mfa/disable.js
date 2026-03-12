import { json, readJson, requireAuth, auditEvent, sha256Base64 } from "../../_lib.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const confirm = body.confirm === true;

  if(!confirm){
    return json(400, "invalid_input", { message:"confirm_true_required" });
  }

  await env.DB.prepare(`
    UPDATE users
    SET
      mfa_enabled = 0,
      mfa_type = NULL,
      mfa_secret = NULL,
      recovery_codes_json = NULL,
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
      action: "mfa_disabled",
      ip_hash: ipHash,
      http_status: 200,
      meta: {}
    });
  }catch{}

  return json(200, "ok", {
    disabled: true,
    mfa_enabled: false
  });
}

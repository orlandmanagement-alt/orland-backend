import { json, readJson, requireAuth } from "../../_lib.js";

const POLICY_KEY = "mfa_policy_v1";

function defaultPolicy(){
  return {
    enabled: 0,
    allow_user_opt_in: 0,
    require_for_super_admin: 0,
    require_for_security_admin: 0,
    require_for_admin: 0,
    allowed_types: ["app"],
    recovery_codes_enabled: 0
  };
}

async function readPolicy(env){
  try{
    const row = await env.DB.prepare(`
      SELECT v
      FROM system_settings
      WHERE k = ?
      LIMIT 1
    `).bind(POLICY_KEY).first();

    if(!row?.v) return defaultPolicy();
    return JSON.parse(row.v);
  }catch{
    return defaultPolicy();
  }
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const enabled = body.enabled === true;
  const mfa_type = String(body.mfa_type || "app").trim();

  const policy = await readPolicy(env);

  if(Number(policy.enabled || 0) !== 1){
    return json(400, "invalid_input", { message:"mfa_policy_disabled" });
  }

  if(Number(policy.allow_user_opt_in || 0) !== 1 && enabled){
    return json(403, "forbidden", { message:"user_mfa_opt_in_disabled" });
  }

  const allowedTypes = Array.isArray(policy.allowed_types) ? policy.allowed_types.map(String) : ["app"];
  if(enabled && !allowedTypes.includes(mfa_type)){
    return json(400, "invalid_input", {
      message:"mfa_type_not_allowed",
      allowed_types: allowedTypes
    });
  }

  await env.DB.prepare(`
    UPDATE users
    SET
      mfa_enabled = ?,
      mfa_type = ?,
      updated_at = strftime('%s','now')
    WHERE id = ?
  `).bind(
    enabled ? 1 : 0,
    enabled ? mfa_type : null,
    a.uid
  ).run();

  return json(200, "ok", {
    saved: true,
    mfa_enabled: enabled,
    mfa_type: enabled ? mfa_type : null
  });
}

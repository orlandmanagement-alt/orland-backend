import { json, requireAuth } from "../../_lib.js";

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

function requiredByRole(roles, policy){
  const s = new Set((roles || []).map(String));
  if(s.has("super_admin") && Number(policy.require_for_super_admin || 0) === 1) return true;
  if(s.has("security_admin") && Number(policy.require_for_security_admin || 0) === 1) return true;
  if(s.has("admin") && Number(policy.require_for_admin || 0) === 1) return true;
  return false;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const policy = await readPolicy(env);

  return json(200, "ok", {
    user: {
      id: a.user?.id || a.uid,
      email_norm: a.user?.email_norm || null,
      display_name: a.user?.display_name || null,
      mfa_enabled: Number(a.user?.mfa_enabled || 0) === 1,
      mfa_type: a.user?.mfa_type || null
    },
    policy,
    mfa_required_by_role: requiredByRole(a.roles || [], policy)
  });
}

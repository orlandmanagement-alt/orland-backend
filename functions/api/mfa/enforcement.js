import { json, requireAuth } from "../../_lib.js";
import { readMfaPolicy, mfaRequiredByRoles } from "./_common.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const policy = await readMfaPolicy(env);
  const required_by_role = mfaRequiredByRoles(a.roles || [], policy);
  const mfa_enabled = Number(a.user?.mfa_enabled || 0) === 1;
  const policy_enabled = Number(policy.enabled || 0) === 1;

  return json(200, "ok", {
    policy_enabled,
    mfa_enabled,
    required_by_role,
    compliant: !policy_enabled ? true : (!required_by_role || mfa_enabled),
    user: {
      id: a.user?.id || a.uid,
      email_norm: a.user?.email_norm || null,
      display_name: a.user?.display_name || null,
      mfa_type: a.user?.mfa_type || null
    },
    policy
  });
}

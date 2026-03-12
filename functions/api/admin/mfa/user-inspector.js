import { json, requireAuth, hasRole } from "../../../_lib.js";
import { readMfaPolicy, mfaRequiredByRoles, safeJsonArray } from "../../mfa/_common.js";

async function getRoleNamesForUser(env, userId){
  const r = await env.DB.prepare(`
    SELECT ro.name AS name
    FROM user_roles ur
    JOIN roles ro ON ro.id = ur.role_id
    WHERE ur.user_id = ?
    ORDER BY ro.name ASC
  `).bind(userId).all();

  return (r.results || []).map(x => String(x.name || ""));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin", "audit_admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const user_id = String(url.searchParams.get("user_id") || "").trim();

  if(!user_id){
    return json(400, "invalid_input", { message:"user_id_required" });
  }

  const user = await env.DB.prepare(`
    SELECT
      id,
      email_norm,
      display_name,
      status,
      mfa_enabled,
      mfa_type,
      mfa_secret,
      recovery_codes_json,
      session_version,
      updated_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(user_id).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  const roles = await getRoleNamesForUser(env, user_id);
  const policy = await readMfaPolicy(env);
  const recoveryCodes = safeJsonArray(user.recovery_codes_json);

  return json(200, "ok", {
    user: {
      id: String(user.id || ""),
      email_norm: user.email_norm || null,
      display_name: user.display_name || null,
      status: user.status || null,
      mfa_enabled: Number(user.mfa_enabled || 0) === 1,
      mfa_type: user.mfa_type || null,
      has_mfa_secret: !!user.mfa_secret,
      recovery_codes_count: recoveryCodes.length,
      session_version: Number(user.session_version || 1),
      updated_at: user.updated_at == null ? null : Number(user.updated_at)
    },
    roles,
    policy: {
      enabled: Number(policy.enabled || 0) === 1,
      allow_user_opt_in: Number(policy.allow_user_opt_in || 0) === 1,
      require_for_super_admin: Number(policy.require_for_super_admin || 0) === 1,
      require_for_security_admin: Number(policy.require_for_security_admin || 0) === 1,
      require_for_admin: Number(policy.require_for_admin || 0) === 1
    },
    required_by_role: mfaRequiredByRoles(roles, policy)
  });
}

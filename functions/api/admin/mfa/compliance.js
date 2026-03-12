import { json, requireAuth, hasRole } from "../../../_lib.js";
import { readMfaPolicy, mfaRequiredByRoles } from "../../mfa/_common.js";

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

function matchSearch(user, roles, q){
  if(!q) return true;
  const hay = [
    user.id,
    user.email_norm,
    user.display_name,
    user.status,
    ...roles
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin", "audit_admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(300, Number(url.searchParams.get("limit") || 100)));

  const policy = await readMfaPolicy(env);

  const usersRes = await env.DB.prepare(`
    SELECT
      id,
      email_norm,
      display_name,
      status,
      mfa_enabled,
      mfa_type,
      mfa_secret,
      recovery_codes_json,
      updated_at
    FROM users
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).bind(limit).all();

  const users = usersRes.results || [];
  const items = [];

  for(const u of users){
    const roles = await getRoleNamesForUser(env, u.id);
    if(!matchSearch(u, roles, q)) continue;

    const required_by_role = mfaRequiredByRoles(roles, policy);
    const mfa_enabled = Number(u.mfa_enabled || 0) === 1;
    const has_secret = !!u.mfa_secret;

    let recovery_codes_count = 0;
    try{
      const arr = JSON.parse(u.recovery_codes_json || "[]");
      recovery_codes_count = Array.isArray(arr) ? arr.length : 0;
    }catch{
      recovery_codes_count = 0;
    }

    items.push({
      user_id: String(u.id || ""),
      email_norm: u.email_norm || null,
      display_name: u.display_name || null,
      status: u.status || null,
      roles,
      required_by_role,
      mfa_enabled,
      mfa_type: u.mfa_type || null,
      has_secret,
      recovery_codes_count,
      compliant: !required_by_role || mfa_enabled,
      updated_at: u.updated_at == null ? null : Number(u.updated_at)
    });
  }

  const summary = {
    total: items.length,
    required: items.filter(x => x.required_by_role).length,
    enabled: items.filter(x => x.mfa_enabled).length,
    compliant: items.filter(x => x.compliant).length,
    non_compliant: items.filter(x => x.required_by_role && !x.mfa_enabled).length
  };

  return json(200, "ok", {
    policy: {
      enabled: Number(policy.enabled || 0) === 1,
      allow_user_opt_in: Number(policy.allow_user_opt_in || 0) === 1,
      require_for_super_admin: Number(policy.require_for_super_admin || 0) === 1,
      require_for_security_admin: Number(policy.require_for_security_admin || 0) === 1,
      require_for_admin: Number(policy.require_for_admin || 0) === 1
    },
    summary,
    items
  });
}

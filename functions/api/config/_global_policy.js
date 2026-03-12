import { nowSec } from "../../_lib.js";

const POLICY_KEY = "global_verification_policy_v1";

export function defaultGlobalVerificationPolicy(){
  return {
    enabled: 0,
    enforce_admin_routes: 0,
    require_email_verified: 0,
    require_phone_verified: 0,
    require_profile_completed: 0,
    require_mfa_for_admin: 0,
    skip_roles: ["super_admin"]
  };
}

function normalizeBool01(v){
  return v ? 1 : 0;
}

function normalizeStringArray(v, fallback = []){
  return Array.isArray(v)
    ? v.map(x => String(x || "").trim()).filter(Boolean)
    : fallback;
}

export function normalizeGlobalVerificationPolicy(v){
  const src = v && typeof v === "object" ? v : {};
  const d = defaultGlobalVerificationPolicy();

  return {
    enabled: normalizeBool01(src.enabled),
    enforce_admin_routes: normalizeBool01(src.enforce_admin_routes),
    require_email_verified: normalizeBool01(src.require_email_verified),
    require_phone_verified: normalizeBool01(src.require_phone_verified),
    require_profile_completed: normalizeBool01(src.require_profile_completed),
    require_mfa_for_admin: normalizeBool01(src.require_mfa_for_admin),
    skip_roles: normalizeStringArray(src.skip_roles, d.skip_roles)
  };
}

export async function loadGlobalVerificationPolicy(env){
  try{
    const row = await env.DB.prepare(`
      SELECT v
      FROM system_settings
      WHERE k = ?
      LIMIT 1
    `).bind(POLICY_KEY).first();

    if(!row?.v){
      return defaultGlobalVerificationPolicy();
    }

    return normalizeGlobalVerificationPolicy(JSON.parse(row.v));
  }catch{
    return defaultGlobalVerificationPolicy();
  }
}

function hasAnyRole(userRoles, expectedRoles){
  const s = new Set((userRoles || []).map(x => String(x || "").trim()));
  return (expectedRoles || []).some(x => s.has(String(x || "").trim()));
}

export function shouldEnforceForPath(path){
  const p = String(path || "").trim();

  if(!p.startsWith("/api/")) return false;

  const allow = [
    "/api/login",
    "/api/logout",
    "/api/me",
    "/api/password/change-required",
    "/api/mfa/status",
    "/api/mfa/enroll",
    "/api/mfa/verify-enroll",
    "/api/mfa/disable",
    "/api/mfa/challenge",
    "/api/mfa/challenge-verify",
    "/api/mfa/login-verify",
    "/api/mfa/recovery-codes",
    "/api/mfa/recovery-codes-export",
    "/api/setup/status",
    "/api/setup/bootstrap-superadmin"
  ];

  if(allow.includes(p)) return false;

  return true;
}

export function resolveVerificationRules(policy, user = null, roles = []){
  const p = normalizeGlobalVerificationPolicy(policy);
  const roleList = (roles || []).map(x => String(x || "").trim());

  const skipped = hasAnyRole(roleList, p.skip_roles || []);
  const adminLike = hasAnyRole(roleList, ["super_admin", "admin", "security_admin", "access_admin", "ops_admin", "audit_admin"]);

  const effective = {
    enabled: p.enabled ? 1 : 0,
    enforce_admin_routes: p.enforce_admin_routes ? 1 : 0,
    require_email_verified: p.require_email_verified ? 1 : 0,
    require_phone_verified: p.require_phone_verified ? 1 : 0,
    require_profile_completed: p.require_profile_completed ? 1 : 0,
    require_mfa_for_admin: p.require_mfa_for_admin ? 1 : 0,
    skip_roles: p.skip_roles || []
  };

  if(skipped){
    effective.enabled = 0;
    effective.require_email_verified = 0;
    effective.require_phone_verified = 0;
    effective.require_profile_completed = 0;
    effective.require_mfa_for_admin = 0;
  }

  if(!adminLike){
    effective.require_mfa_for_admin = 0;
  }

  return effective;
}

export async function getEffectiveVerificationState(env, user = null, roles = []){
  const policy = await loadGlobalVerificationPolicy(env);
  const effective = resolveVerificationRules(policy, user, roles);

  const u = user && typeof user === "object" ? user : {};
  const checks = {
    email_verified: Number(u.email_verified || 0) === 1,
    phone_verified: Number(u.phone_verified || 0) === 1,
    profile_completed: Number(u.profile_completed || 0) === 1,
    mfa_enabled: Number(u.mfa_enabled || 0) === 1
  };

  const required_actions = [];

  if(Number(effective.enabled || 0) === 1){
    if(Number(effective.require_email_verified || 0) === 1 && !checks.email_verified){
      required_actions.push("verify_email");
    }
    if(Number(effective.require_phone_verified || 0) === 1 && !checks.phone_verified){
      required_actions.push("verify_phone");
    }
    if(Number(effective.require_profile_completed || 0) === 1 && !checks.profile_completed){
      required_actions.push("complete_profile");
    }
    if(Number(effective.require_mfa_for_admin || 0) === 1 && !checks.mfa_enabled){
      required_actions.push("enable_mfa");
    }
  }

  const compliant = required_actions.length === 0;

  return {
    effective,
    summary: {
      checked_at: nowSec(),
      roles: (roles || []).map(String),
      enabled: Number(effective.enabled || 0) === 1
    },
    compliance: {
      compliant,
      scope: Number(effective.enabled || 0) === 1 ? "global_verification_policy" : "disabled",
      required_actions,
      checks
    }
  };
}

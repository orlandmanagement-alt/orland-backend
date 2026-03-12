import { nowSec } from "../../_lib.js";

const POLICY_KEY = "global_verification_policy_v1";

function defaultPolicy(){
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

function normalizePolicy(v){
  const d = defaultPolicy();
  const src = v && typeof v === "object" ? v : {};
  return {
    enabled: src.enabled ? 1 : 0,
    enforce_admin_routes: src.enforce_admin_routes ? 1 : 0,
    require_email_verified: src.require_email_verified ? 1 : 0,
    require_phone_verified: src.require_phone_verified ? 1 : 0,
    require_profile_completed: src.require_profile_completed ? 1 : 0,
    require_mfa_for_admin: src.require_mfa_for_admin ? 1 : 0,
    skip_roles: Array.isArray(src.skip_roles)
      ? src.skip_roles.map(x => String(x || "").trim()).filter(Boolean)
      : d.skip_roles
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
    return normalizePolicy(JSON.parse(row.v));
  }catch{
    return defaultPolicy();
  }
}

function hasAnyRole(roles, wanted){
  const s = new Set((roles || []).map(String));
  return (wanted || []).some(x => s.has(String(x)));
}

export function shouldEnforceForPath(pathname){
  const p = String(pathname || "");
  if(!p.startsWith("/api/")) return false;
  if(p === "/api/login" || p === "/api/logout" || p === "/api/me") return false;
  if(p.startsWith("/api/setup/")) return false;
  return true;
}

export async function getEffectiveVerificationState(env, user, roles){
  const effective = await readPolicy(env);
  const scope = hasAnyRole(roles, ["super_admin","admin","staff"]) ? "admin" : "user";
  const skip = hasAnyRole(roles, effective.skip_roles || []);

  const emailVerified = Number(user?.email_verified || 0) === 1;
  const phoneVerified = Number(user?.phone_verified || 0) === 1;
  const profileCompleted = Number(user?.profile_completed || 0) === 1;
  const mfaEnabled = Number(user?.mfa_enabled || 0) === 1;

  const checks = {
    email_verified: {
      required: Number(effective.require_email_verified || 0) === 1,
      value: emailVerified,
      supported: Object.prototype.hasOwnProperty.call(user || {}, "email_verified")
    },
    phone_verified: {
      required: Number(effective.require_phone_verified || 0) === 1,
      value: phoneVerified,
      supported: Object.prototype.hasOwnProperty.call(user || {}, "phone_verified")
    },
    profile_completed: {
      required: Number(effective.require_profile_completed || 0) === 1,
      value: profileCompleted,
      supported: Object.prototype.hasOwnProperty.call(user || {}, "profile_completed")
    },
    mfa_enabled: {
      required: scope === "admin" && Number(effective.require_mfa_for_admin || 0) === 1,
      value: mfaEnabled,
      supported: Object.prototype.hasOwnProperty.call(user || {}, "mfa_enabled")
    }
  };

  const required_actions = [];

  if(Number(effective.enabled || 0) !== 1 || skip){
    return {
      effective,
      summary: {
        enabled: Number(effective.enabled || 0) === 1,
        skipped: skip,
        scope
      },
      compliance: {
        compliant: true,
        scope,
        required_actions,
        checks
      }
    };
  }

  if(checks.email_verified.required && !checks.email_verified.value){
    required_actions.push("verify_email");
  }
  if(checks.phone_verified.required && !checks.phone_verified.value){
    required_actions.push("verify_phone");
  }
  if(checks.profile_completed.required && !checks.profile_completed.value){
    required_actions.push("complete_profile");
  }
  if(checks.mfa_enabled.required && !checks.mfa_enabled.value){
    required_actions.push("enable_mfa");
  }

  return {
    effective,
    summary: {
      enabled: Number(effective.enabled || 0) === 1,
      skipped: skip,
      scope,
      generated_at: nowSec()
    },
    compliance: {
      compliant: required_actions.length === 0,
      scope,
      required_actions,
      checks
    }
  };
}

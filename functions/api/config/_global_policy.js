import { nowSec } from "../../_lib.js";

const SETTINGS_KEY = "global_verification_policy";

function defaults(){
  return {
    client: {
      enable_two_step: 0,
      verify_sms_wa: 0,
      verify_email: 0,
      verify_kyc: 0
    },
    talent: {
      enable_two_step: 0,
      verify_sms_wa: 0,
      verify_email: 0,
      verify_kyc: 0
    },
    updated_at: 0
  };
}

function to01(v){
  return v ? 1 : 0;
}

function normalizeScope(v = {}){
  return {
    enable_two_step: to01(v.enable_two_step),
    verify_sms_wa: to01(v.verify_sms_wa),
    verify_email: to01(v.verify_email),
    verify_kyc: to01(v.verify_kyc)
  };
}

function normalizePolicy(v = {}){
  const d = defaults();
  return {
    client: normalizeScope(v.client || d.client),
    talent: normalizeScope(v.talent || d.talent),
    updated_at: Number(v.updated_at || nowSec())
  };
}

export async function loadGlobalVerificationPolicy(env){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k=?
    LIMIT 1
  `).bind(SETTINGS_KEY).first();

  if(!row?.v) return defaults();

  try{
    return normalizePolicy(JSON.parse(String(row.v || "{}")));
  }catch{
    return defaults();
  }
}

export function detectVerificationScopeFromRoles(roles = []){
  const xs = Array.isArray(roles) ? roles.map(x => String(x || "").trim()) : [];
  if(xs.includes("talent")) return "talent";
  if(xs.includes("client")) return "client";
  return "admin";
}

export function resolveVerificationRules(policy, roles = []){
  const scope = detectVerificationScopeFromRoles(roles);
  if(scope === "client") return { scope, rules: normalizeScope(policy?.client || {}) };
  if(scope === "talent") return { scope, rules: normalizeScope(policy?.talent || {}) };
  return {
    scope: "admin",
    rules: {
      enable_two_step: 0,
      verify_sms_wa: 0,
      verify_email: 0,
      verify_kyc: 0
    }
  };
}

export async function getUserVerificationSummary(env, userId){
  const user = await env.DB.prepare(`
    SELECT
      email_norm,
      email_verified,
      email_verified_at,
      phone_verified,
      phone_verified_at
    FROM users
    WHERE id=?
    LIMIT 1
  `).bind(userId).first();

  const sec = await env.DB.prepare(`
    SELECT email_2fa_enabled
    FROM user_security
    WHERE user_id=?
    LIMIT 1
  `).bind(userId).first();

  const kyc = await env.DB.prepare(`
    SELECT status
    FROM user_verifications
    WHERE user_id=? AND kind='kyc'
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(userId).first();

  return {
    email_norm: String(user?.email_norm || ""),
    email_verified: Number(user?.email_verified || 0),
    email_verified_at: Number(user?.email_verified_at || 0),
    phone_verified: Number(user?.phone_verified || 0),
    phone_verified_at: Number(user?.phone_verified_at || 0),
    email_2fa_enabled: Number(sec?.email_2fa_enabled || 0),
    kyc_status: String(kyc?.status || "none")
  };
}

export function evaluateVerificationCompliance(effective, summary){
  const scope = String(effective?.scope || "admin");
  const rules = effective?.rules || {};
  const s = summary || {};

  if(scope === "admin"){
    return {
      scope,
      compliant: true,
      required_actions: [],
      checks: {
        enable_two_step: false,
        verify_sms_wa: false,
        verify_email: false,
        verify_kyc: false
      }
    };
  }

  const required_actions = [];
  const checks = {
    enable_two_step: !Number(rules.enable_two_step || 0) || !!Number(s.email_2fa_enabled || 0),
    verify_sms_wa: !Number(rules.verify_sms_wa || 0) || !!Number(s.phone_verified || 0),
    verify_email: !Number(rules.verify_email || 0) || !!Number(s.email_verified || 0),
    verify_kyc: !Number(rules.verify_kyc || 0) || ["approved","verified"].includes(String(s.kyc_status || ""))
  };

  if(!checks.enable_two_step) required_actions.push("enable_two_step");
  if(!checks.verify_sms_wa) required_actions.push("verify_phone");
  if(!checks.verify_email) required_actions.push("verify_email");
  if(!checks.verify_kyc) required_actions.push("verify_kyc");

  return {
    scope,
    compliant: required_actions.length === 0,
    required_actions,
    checks
  };
}

export async function getEffectiveVerificationState(env, user, roles){
  const policy = await loadGlobalVerificationPolicy(env);
  const effective = resolveVerificationRules(policy, roles || []);
  const summary = await getUserVerificationSummary(env, user?.id);
  const compliance = evaluateVerificationCompliance(effective, summary);

  return {
    policy,
    effective,
    summary,
    compliance
  };
}

export function shouldEnforceForPath(pathname){
  const p = String(pathname || "/");
  if(!p.startsWith("/api/")) return false;

  const allow = [
    "/api/me",
    "/api/logout",
    "/api/security/otp-send",
    "/api/security/otp-verify",
    "/api/profile",
    "/api/profile/security",
    "/api/config/global_effective"
  ];

  if(allow.includes(p)) return false;
  if(p.startsWith("/api/config/")) return false;
  if(p.startsWith("/api/security/policy")) return false;

  return true;
}

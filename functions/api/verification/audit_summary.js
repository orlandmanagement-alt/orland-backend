import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function scalar(env, sql, ...bind){
  const row = await env.DB.prepare(sql).bind(...bind).first();
  const k = row ? Object.keys(row)[0] : "";
  return Number(row?.[k] || 0);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") || "30")));
  const since = nowSec() - (days * 86400);

  const pending_kyc = await scalar(
    env,
    `SELECT COUNT(*) AS total FROM user_verifications WHERE kind='kyc' AND status='pending'`
  );

  const approved_kyc = await scalar(
    env,
    `SELECT COUNT(*) AS total FROM user_verifications WHERE kind='kyc' AND status IN ('approved','verified')`
  );

  const rejected_kyc = await scalar(
    env,
    `SELECT COUNT(*) AS total FROM user_verifications WHERE kind='kyc' AND status='rejected'`
  );

  const phone_verified_total = await scalar(
    env,
    `SELECT COUNT(*) AS total FROM users WHERE COALESCE(phone_verified,0)=1`
  );

  let email_verified_total = 0;
  try{
    email_verified_total = await scalar(
      env,
      `SELECT COUNT(*) AS total FROM users WHERE COALESCE(email_verified,0)=1`
    );
  }catch{}

  const two_step_enabled_total = await scalar(
    env,
    `SELECT COUNT(*) AS total FROM user_security WHERE COALESCE(email_2fa_enabled,0)=1`
  );

  const phone_otp_requests_window = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM audit_logs
     WHERE action='verification_phone_otp_requested'
       AND created_at>=?`,
    since
  );

  const phone_verified_window = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM audit_logs
     WHERE action='verification_phone_completed'
       AND created_at>=?`,
    since
  );

  const email_verified_window = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM audit_logs
     WHERE action='verification_email_completed'
       AND created_at>=?`,
    since
  );

  const kyc_submitted_window = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM audit_logs
     WHERE action='kyc_submitted'
       AND created_at>=?`,
    since
  );

  const kyc_reviewed_window = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM audit_logs
     WHERE action IN ('kyc_approved','kyc_rejected')
       AND created_at>=?`,
    since
  );

  const verification_policy_blocks = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM audit_logs
     WHERE action='verification_policy_block'
       AND created_at>=?`,
    since
  );

  return json(200, "ok", {
    days,
    pending_kyc,
    approved_kyc,
    rejected_kyc,
    phone_verified_total,
    email_verified_total,
    two_step_enabled_total,
    phone_otp_requests_window,
    phone_verified_window,
    email_verified_window,
    kyc_submitted_window,
    kyc_reviewed_window,
    verification_policy_blocks
  });
}

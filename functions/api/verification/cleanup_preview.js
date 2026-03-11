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
  const otpExpiredDays = Math.max(1, Math.min(365, Number(url.searchParams.get("otp_expired_days") || "7")));
  const otpConsumedDays = Math.max(1, Math.min(365, Number(url.searchParams.get("otp_consumed_days") || "30")));
  const pendingKycDays = Math.max(1, Math.min(3650, Number(url.searchParams.get("pending_kyc_days") || "30")));
  const auditRetentionDays = Math.max(1, Math.min(3650, Number(url.searchParams.get("audit_retention_days") || "180")));

  const now = nowSec();
  const otpExpiredBefore = now - (otpExpiredDays * 86400);
  const otpConsumedBefore = now - (otpConsumedDays * 86400);
  const pendingKycBefore = now - (pendingKycDays * 86400);
  const auditBefore = now - (auditRetentionDays * 86400);

  const verificationActions = [
    "verification_email_send_requested",
    "verification_email_completed",
    "verification_phone_otp_requested",
    "verification_phone_completed",
    "two_step_enabled",
    "kyc_requested",
    "kyc_submitted",
    "kyc_approved",
    "kyc_rejected",
    "verification_policy_block"
  ];

  const otp_expired_unused = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM otp_requests
     WHERE consumed_at IS NULL
       AND expires_at < ?
       AND created_at < ?`,
    now,
    otpExpiredBefore
  );

  const otp_consumed_old = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM otp_requests
     WHERE consumed_at IS NOT NULL
       AND consumed_at < ?`,
    otpConsumedBefore
  );

  const pending_kyc_stale = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM user_verifications
     WHERE kind='kyc'
       AND status='pending'
       AND created_at < ?`,
    pendingKycBefore
  );

  const audit_placeholders = verificationActions.map(()=>"?").join(",");
  const audit_old = await scalar(
    env,
    `SELECT COUNT(*) AS total
     FROM audit_logs
     WHERE action IN (${audit_placeholders})
       AND created_at < ?`,
    ...verificationActions,
    auditBefore
  );

  return json(200, "ok", {
    thresholds: {
      otp_expired_days: otpExpiredDays,
      otp_consumed_days: otpConsumedDays,
      pending_kyc_days: pendingKycDays,
      audit_retention_days: auditRetentionDays
    },
    preview: {
      otp_expired_unused,
      otp_consumed_old,
      pending_kyc_stale,
      audit_old
    }
  });
}

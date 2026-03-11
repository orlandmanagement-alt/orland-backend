import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

const VERIFICATION_ACTIONS = [
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

async function runStmt(env, sql, ...bind){
  const r = await env.DB.prepare(sql).bind(...bind).run();
  return Number(r?.meta?.changes || 0);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  if(String(body.confirm || "") !== "RUN_VERIFICATION_CLEANUP_V1"){
    return json(400, "invalid_input", {
      message: "confirm_required",
      expected: "RUN_VERIFICATION_CLEANUP_V1"
    });
  }

  const otpExpiredDays = Math.max(1, Math.min(365, Number(body.otp_expired_days || 7)));
  const otpConsumedDays = Math.max(1, Math.min(365, Number(body.otp_consumed_days || 30)));
  const pendingKycDays = Math.max(1, Math.min(3650, Number(body.pending_kyc_days || 30)));
  const auditRetentionDays = Math.max(1, Math.min(3650, Number(body.audit_retention_days || 180)));

  const now = nowSec();
  const otpExpiredBefore = now - (otpExpiredDays * 86400);
  const otpConsumedBefore = now - (otpConsumedDays * 86400);
  const pendingKycBefore = now - (pendingKycDays * 86400);
  const auditBefore = now - (auditRetentionDays * 86400);

  const otp_expired_unused_deleted = await runStmt(
    env,
    `DELETE FROM otp_requests
     WHERE consumed_at IS NULL
       AND expires_at < ?
       AND created_at < ?`,
    now,
    otpExpiredBefore
  );

  const otp_consumed_old_deleted = await runStmt(
    env,
    `DELETE FROM otp_requests
     WHERE consumed_at IS NOT NULL
       AND consumed_at < ?`,
    otpConsumedBefore
  );

  const pending_kyc_expired = await runStmt(
    env,
    `UPDATE user_verifications
     SET status='expired',
         updated_at=?
     WHERE kind='kyc'
       AND status='pending'
       AND created_at < ?`,
    now,
    pendingKycBefore
  );

  const audit_placeholders = VERIFICATION_ACTIONS.map(()=>"?").join(",");
  const audit_old_deleted = await runStmt(
    env,
    `DELETE FROM audit_logs
     WHERE action IN (${audit_placeholders})
       AND created_at < ?`,
    ...VERIFICATION_ACTIONS,
    auditBefore
  );

  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    a.user.id,
    "verification_cleanup_run",
    "system",
    null,
    JSON.stringify({
      otp_expired_days: otpExpiredDays,
      otp_consumed_days: otpConsumedDays,
      pending_kyc_days: pendingKycDays,
      audit_retention_days: auditRetentionDays,
      result: {
        otp_expired_unused_deleted,
        otp_consumed_old_deleted,
        pending_kyc_expired,
        audit_old_deleted
      }
    }),
    now
  ).run();

  return json(200, "ok", {
    ran: true,
    thresholds: {
      otp_expired_days: otpExpiredDays,
      otp_consumed_days: otpConsumedDays,
      pending_kyc_days: pendingKycDays,
      audit_retention_days: auditRetentionDays
    },
    result: {
      otp_expired_unused_deleted,
      otp_consumed_old_deleted,
      pending_kyc_expired,
      audit_old_deleted
    }
  });
}

import { json, nowSec } from "../../_lib.js";

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

async function getSetting(env, k, fallback=""){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k=?
    LIMIT 1
  `).bind(k).first();
  return row ? String(row.v || "") : String(fallback || "");
}

async function setSetting(env, k, v, isSecret=0){
  const ts = nowSec();
  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, is_secret, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v=excluded.v,
      is_secret=excluded.is_secret,
      updated_at=excluded.updated_at
  `).bind(k, String(v ?? ""), Number(isSecret ? 1 : 0), ts).run();
}

async function runStmt(env, sql, ...bind){
  const r = await env.DB.prepare(sql).bind(...bind).run();
  return Number(r?.meta?.changes || 0);
}

async function addAudit(env, action, meta){
  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, NULL, ?, 'system', NULL, ?, ?)
  `).bind(
    crypto.randomUUID(),
    String(action || "verification_cleanup_cron"),
    JSON.stringify(meta || {}),
    nowSec()
  ).run();
}

export async function onRequestGet({ env, request }){
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const now = nowSec();

  const enabled = await getSetting(env, "verification_cleanup_cron_enabled", "0");
  const intervalSec = Math.max(300, Number(await getSetting(env, "verification_cleanup_cron_interval_sec", "86400") || "86400"));
  const lastRunAt = Number(await getSetting(env, "verification_cleanup_cron_last_run_at", "0") || "0");

  if(enabled !== "1"){
    await setSetting(env, "verification_cleanup_cron_last_status", "disabled");
    await setSetting(env, "verification_cleanup_cron_last_result", JSON.stringify({
      ran: false,
      status: "disabled"
    }));
    return json(200, "ok", {
      ran: false,
      status: "disabled",
      message: "verification cleanup cron disabled"
    });
  }

  if(!force && lastRunAt > 0 && (now - lastRunAt) < intervalSec){
    const nextIn = intervalSec - (now - lastRunAt);
    await setSetting(env, "verification_cleanup_cron_last_status", "skip_interval");
    await setSetting(env, "verification_cleanup_cron_last_result", JSON.stringify({
      ran: false,
      status: "skip_interval",
      next_in_sec: nextIn
    }));
    return json(200, "ok", {
      ran: false,
      status: "skip_interval",
      next_in_sec: nextIn
    });
  }

  const otpExpiredDays = Math.max(1, Math.min(365, Number(await getSetting(env, "verification_cleanup_otp_expired_days", "7") || "7")));
  const otpConsumedDays = Math.max(1, Math.min(365, Number(await getSetting(env, "verification_cleanup_otp_consumed_days", "30") || "30")));
  const pendingKycDays = Math.max(1, Math.min(3650, Number(await getSetting(env, "verification_cleanup_pending_kyc_days", "30") || "30")));
  const auditRetentionDays = Math.max(1, Math.min(3650, Number(await getSetting(env, "verification_cleanup_audit_retention_days", "180") || "180")));

  const otpExpiredBefore = now - (otpExpiredDays * 86400);
  const otpConsumedBefore = now - (otpConsumedDays * 86400);
  const pendingKycBefore = now - (pendingKycDays * 86400);
  const auditBefore = now - (auditRetentionDays * 86400);

  try{
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

    const placeholders = VERIFICATION_ACTIONS.map(()=>"?").join(",");
    const audit_old_deleted = await runStmt(
      env,
      `DELETE FROM audit_logs
       WHERE action IN (${placeholders})
         AND created_at < ?`,
      ...VERIFICATION_ACTIONS,
      auditBefore
    );

    const result = {
      ran: true,
      status: "ok",
      force,
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
    };

    await setSetting(env, "verification_cleanup_cron_last_run_at", String(now));
    await setSetting(env, "verification_cleanup_cron_last_status", "ok");
    await setSetting(env, "verification_cleanup_cron_last_result", JSON.stringify(result));
    await addAudit(env, "verification_cleanup_cron_ok", result);

    return json(200, "ok", result);
  }catch(e){
    const result = {
      ran: false,
      status: "error",
      error: String(e?.message || e)
    };
    await setSetting(env, "verification_cleanup_cron_last_run_at", String(now));
    await setSetting(env, "verification_cleanup_cron_last_status", "error");
    await setSetting(env, "verification_cleanup_cron_last_result", JSON.stringify(result));
    await addAudit(env, "verification_cleanup_cron_error", result);

    return json(200, "ok", result);
  }
}

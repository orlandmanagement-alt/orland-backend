import { json, requireAuth, hasRole } from "../../_lib.js";

async function getSetting(env, k, fallback=""){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k=?
    LIMIT 1
  `).bind(k).first();
  return row ? String(row.v || "") : String(fallback || "");
}

export async function onRequestGet({ env, request }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  let lastResult = {};
  try{
    lastResult = JSON.parse(await getSetting(env, "verification_cleanup_cron_last_result", "{}"));
  }catch{}

  return json(200, "ok", {
    enabled: (await getSetting(env, "verification_cleanup_cron_enabled", "0")) === "1",
    interval_sec: Number(await getSetting(env, "verification_cleanup_cron_interval_sec", "86400") || "86400"),
    last_run_at: Number(await getSetting(env, "verification_cleanup_cron_last_run_at", "0") || "0"),
    last_status: await getSetting(env, "verification_cleanup_cron_last_status", "idle"),
    thresholds: {
      otp_expired_days: Number(await getSetting(env, "verification_cleanup_otp_expired_days", "7") || "7"),
      otp_consumed_days: Number(await getSetting(env, "verification_cleanup_otp_consumed_days", "30") || "30"),
      pending_kyc_days: Number(await getSetting(env, "verification_cleanup_pending_kyc_days", "30") || "30"),
      audit_retention_days: Number(await getSetting(env, "verification_cleanup_audit_retention_days", "180") || "180")
    },
    last_result: lastResult
  });
}

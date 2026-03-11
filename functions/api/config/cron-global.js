import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

const KEYS = {
  enabled: "verification_cleanup_cron_enabled",
  interval_sec: "verification_cleanup_cron_interval_sec",
  otp_expired_days: "verification_cleanup_otp_expired_days",
  otp_consumed_days: "verification_cleanup_otp_consumed_days",
  pending_kyc_days: "verification_cleanup_pending_kyc_days",
  audit_retention_days: "verification_cleanup_audit_retention_days"
};

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

function normalize(data = {}){
  return {
    enabled: !!Number(data.enabled || 0),
    interval_sec: Math.max(300, Math.min(2592000, Number(data.interval_sec || 86400))),
    otp_expired_days: Math.max(1, Math.min(365, Number(data.otp_expired_days || 7))),
    otp_consumed_days: Math.max(1, Math.min(365, Number(data.otp_consumed_days || 30))),
    pending_kyc_days: Math.max(1, Math.min(3650, Number(data.pending_kyc_days || 30))),
    audit_retention_days: Math.max(1, Math.min(3650, Number(data.audit_retention_days || 180)))
  };
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const value = normalize({
    enabled: await getSetting(env, KEYS.enabled, "0"),
    interval_sec: await getSetting(env, KEYS.interval_sec, "86400"),
    otp_expired_days: await getSetting(env, KEYS.otp_expired_days, "7"),
    otp_consumed_days: await getSetting(env, KEYS.otp_consumed_days, "30"),
    pending_kyc_days: await getSetting(env, KEYS.pending_kyc_days, "30"),
    audit_retention_days: await getSetting(env, KEYS.audit_retention_days, "180")
  });

  return json(200, "ok", value);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const v = normalize(body);

  await setSetting(env, KEYS.enabled, v.enabled ? "1" : "0");
  await setSetting(env, KEYS.interval_sec, String(v.interval_sec));
  await setSetting(env, KEYS.otp_expired_days, String(v.otp_expired_days));
  await setSetting(env, KEYS.otp_consumed_days, String(v.otp_consumed_days));
  await setSetting(env, KEYS.pending_kyc_days, String(v.pending_kyc_days));
  await setSetting(env, KEYS.audit_retention_days, String(v.audit_retention_days));

  return json(200, "ok", {
    saved: true,
    value: v
  });
}

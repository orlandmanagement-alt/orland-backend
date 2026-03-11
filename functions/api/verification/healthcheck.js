import { json, requireAuth, hasRole } from "../../_lib.js";

async function tableExists(env, table){
  const row = await env.DB.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type='table' AND name=?
    LIMIT 1
  `).bind(table).first();
  return !!row?.name;
}

async function tableColumns(env, table){
  try{
    const r = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (r.results || []).map(x => String(x.name || ""));
  }catch{
    return [];
  }
}

function hasAll(cols, required){
  const s = new Set((cols || []).map(String));
  return required.every(x => s.has(String(x)));
}

async function scalar(env, sql, ...bind){
  try{
    const row = await env.DB.prepare(sql).bind(...bind).first();
    const k = row ? Object.keys(row)[0] : "";
    return Number(row?.[k] || 0);
  }catch{
    return 0;
  }
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const usersExists = await tableExists(env, "users");
  const userSecurityExists = await tableExists(env, "user_security");
  const userVerificationsExists = await tableExists(env, "user_verifications");
  const otpRequestsExists = await tableExists(env, "otp_requests");
  const auditLogsExists = await tableExists(env, "audit_logs");

  const usersCols = usersExists ? await tableColumns(env, "users") : [];
  const userSecurityCols = userSecurityExists ? await tableColumns(env, "user_security") : [];
  const userVerificationsCols = userVerificationsExists ? await tableColumns(env, "user_verifications") : [];
  const otpRequestsCols = otpRequestsExists ? await tableColumns(env, "otp_requests") : [];

  const checks = {
    users: {
      exists: usersExists,
      columns_ok: hasAll(usersCols, [
        "id",
        "email_norm",
        "phone_e164",
        "phone_verified",
        "phone_verified_at",
        "email_verified",
        "email_verified_at",
        "updated_at"
      ]),
      columns: usersCols
    },
    user_security: {
      exists: userSecurityExists,
      columns_ok: hasAll(userSecurityCols, [
        "user_id",
        "email_2fa_enabled",
        "updated_at"
      ]),
      columns: userSecurityCols
    },
    user_verifications: {
      exists: userVerificationsExists,
      columns_ok: hasAll(userVerificationsCols, [
        "id",
        "user_id",
        "kind",
        "status",
        "evidence_json",
        "reviewed_by_user_id",
        "reviewed_at",
        "created_at",
        "updated_at"
      ]),
      columns: userVerificationsCols
    },
    otp_requests: {
      exists: otpRequestsExists,
      columns_ok: hasAll(otpRequestsCols, [
        "id",
        "purpose",
        "identifier_hash",
        "otp_hash",
        "otp_salt",
        "attempts",
        "max_attempts",
        "created_at",
        "expires_at",
        "consumed_at"
      ]),
      columns: otpRequestsCols
    },
    audit_logs: {
      exists: auditLogsExists
    }
  };

  const ok =
    checks.users.exists && checks.users.columns_ok &&
    checks.user_security.exists && checks.user_security.columns_ok &&
    checks.user_verifications.exists && checks.user_verifications.columns_ok &&
    checks.otp_requests.exists && checks.otp_requests.columns_ok &&
    checks.audit_logs.exists;

  const counts = {
    users_total: await scalar(env, `SELECT COUNT(*) AS total FROM users`),
    user_security_total: await scalar(env, `SELECT COUNT(*) AS total FROM user_security`),
    user_verifications_total: await scalar(env, `SELECT COUNT(*) AS total FROM user_verifications`),
    otp_requests_total: await scalar(env, `SELECT COUNT(*) AS total FROM otp_requests`),
    audit_logs_total: await scalar(env, `SELECT COUNT(*) AS total FROM audit_logs`)
  };

  return json(200, "ok", {
    ok,
    checks,
    counts
  });
}

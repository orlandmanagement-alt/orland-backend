import { json, requireAuth, hasRole } from "../../_lib.js";

const APP_KEYS = [
  "otp.default_channel",
  "otp.resend_cooldown_sec",
  "otp.expiry_sec",
  "otp.email_provider",
  "otp.email_from",
  "otp.resend_api_key",
  "otp.sms_provider",
  "otp.sms_api_key",
  "otp.sms_sender",
  "otp.wa_provider",
  "otp.wa_api_key",
  "otp.wa_sender"
];

function canManage(a){
  return hasRole(a.roles, ["super_admin", "admin", "security_admin"]);
}

async function ensureTable(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_settings (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
}

async function loadSettings(env){
  const placeholders = APP_KEYS.map(() => "?").join(",");
  const r = await env.DB.prepare(`
    SELECT k, v
    FROM app_settings
    WHERE k IN (${placeholders})
  `).bind(...APP_KEYS).all();

  const map = {};
  for(const row of (r.results || [])){
    map[String(row.k || "")] = String(row.v || "");
  }

  return {
    otp_default_channel: map["otp.default_channel"] ?? "email",
    otp_resend_cooldown_sec: map["otp.resend_cooldown_sec"] ?? "30",
    otp_expiry_sec: map["otp.expiry_sec"] ?? "300",
    otp_email_provider: map["otp.email_provider"] ?? "resend",
    otp_email_from: map["otp.email_from"] ?? "no-reply@orlandmanagement.com",
    otp_resend_api_key: map["otp.resend_api_key"] ?? "",
    otp_sms_provider: map["otp.sms_provider"] ?? "disabled",
    otp_sms_api_key: map["otp.sms_api_key"] ?? "",
    otp_sms_sender: map["otp.sms_sender"] ?? "ORLAND",
    otp_wa_provider: map["otp.wa_provider"] ?? "disabled",
    otp_wa_api_key: map["otp.wa_api_key"] ?? "",
    otp_wa_sender: map["otp.wa_sender"] ?? ""
  };
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403, "forbidden", null);

  const url = String(env.SSO_SYNC_URL || "").trim();
  const token = String(env.INTERNAL_SYNC_TOKEN || "").trim();

  if(!url) return json(500, "config_error", { message:"missing_SSO_SYNC_URL" });
  if(!token) return json(500, "config_error", { message:"missing_INTERNAL_SYNC_TOKEN" });

  try{
    await ensureTable(env);
    const payload = await loadSettings(env);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    let data = null;
    try{ data = await res.json(); }catch{}

    if(!res.ok){
      return json(502, "push_failed", {
        http_status: res.status,
        response: data
      });
    }

    return json(200, "ok", {
      pushed: true,
      response: data
    });
  }catch(err){
    return json(500, "push_failed", {
      message: String(err?.message || err)
    });
  }
}

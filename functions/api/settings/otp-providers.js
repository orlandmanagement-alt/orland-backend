import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

const KEYS = [
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

const DEFAULTS = {
  "otp.default_channel": "email",
  "otp.resend_cooldown_sec": "30",
  "otp.expiry_sec": "300",
  "otp.email_provider": "resend",
  "otp.email_from": "no-reply@orlandmanagement.com",
  "otp.resend_api_key": "",
  "otp.sms_provider": "disabled",
  "otp.sms_api_key": "",
  "otp.sms_sender": "ORLAND",
  "otp.wa_provider": "disabled",
  "otp.wa_api_key": "",
  "otp.wa_sender": ""
};

function canManage(a){
  return hasRole(a.roles, ["super_admin", "admin", "security_admin"]);
}

function maskSecret(v){
  const s = String(v || "");
  if(!s) return "";
  if(s.length <= 8) return "********";
  return s.slice(0, 4) + "********" + s.slice(-4);
}

function normalizePayload(body = {}){
  const out = {};
  for(const k of KEYS){
    out[k] = String(body[k] ?? DEFAULTS[k] ?? "").trim();
  }

  const dc = out["otp.default_channel"].toLowerCase();
  out["otp.default_channel"] = ["email","sms","whatsapp"].includes(dc) ? dc : "email";

  const ep = out["otp.email_provider"].toLowerCase();
  out["otp.email_provider"] = ["resend","disabled"].includes(ep) ? ep : "resend";

  const sp = out["otp.sms_provider"].toLowerCase();
  out["otp.sms_provider"] = ["disabled","twilio","vonage"].includes(sp) ? sp : "disabled";

  const wp = out["otp.wa_provider"].toLowerCase();
  out["otp.wa_provider"] = ["disabled","twilio","wablas","fonnte"].includes(wp) ? wp : "disabled";

  const cooldown = Math.max(5, Math.min(600, Number(out["otp.resend_cooldown_sec"] || 30)));
  const expiry = Math.max(60, Math.min(1800, Number(out["otp.expiry_sec"] || 300)));

  out["otp.resend_cooldown_sec"] = String(cooldown);
  out["otp.expiry_sec"] = String(expiry);

  return out;
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

async function loadAll(env){
  const placeholders = KEYS.map(() => "?").join(",");
  const r = await env.DB.prepare(`
    SELECT k, v, updated_at
    FROM app_settings
    WHERE k IN (${placeholders})
    ORDER BY k ASC
  `).bind(...KEYS).all();

  const map = {};
  let maxUpdated = 0;

  for(const row of (r.results || [])){
    map[String(row.k || "")] = String(row.v || "");
    maxUpdated = Math.max(maxUpdated, Number(row.updated_at || 0));
  }

  const value = {};
  const masked = {};

  for(const k of KEYS){
    const v = map[k] ?? DEFAULTS[k] ?? "";
    value[k] = v;
    masked[k] = /api_key/i.test(k) ? maskSecret(v) : v;
  }

  return {
    value,
    masked,
    updated_at: maxUpdated
  };
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403, "forbidden", null);

  await ensureTable(env);
  const out = await loadAll(env);

  return json(200, "ok", {
    settings: out.value,
    masked: out.masked,
    updated_at: out.updated_at
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403, "forbidden", null);

  await ensureTable(env);

  const body = await readJson(request) || {};
  const clean = normalizePayload(body);
  const ts = nowSec();

  for(const k of KEYS){
    await env.DB.prepare(`
      INSERT INTO app_settings (k, v, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(k) DO UPDATE SET
        v=excluded.v,
        updated_at=excluded.updated_at
    `).bind(k, clean[k], ts).run();
  }

  const out = await loadAll(env);

  return json(200, "ok", {
    saved: true,
    settings: out.value,
    masked: out.masked,
    updated_at: out.updated_at
  });
}

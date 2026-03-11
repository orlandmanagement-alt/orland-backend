import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

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

function toBool01(v){
  return v ? 1 : 0;
}

function normalizeScope(v = {}){
  return {
    enable_two_step: toBool01(v.enable_two_step),
    verify_sms_wa: toBool01(v.verify_sms_wa),
    verify_email: toBool01(v.verify_email),
    verify_kyc: toBool01(v.verify_kyc)
  };
}

function normalizePayload(v = {}){
  const base = defaults();
  return {
    client: normalizeScope(v.client || base.client),
    talent: normalizeScope(v.talent || base.talent),
    updated_at: nowSec()
  };
}

async function getSetting(env, key){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k=?
    LIMIT 1
  `).bind(key).first();

  return row ? String(row.v || "") : "";
}

async function setSetting(env, key, value, isSecret = 0){
  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, is_secret, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v=excluded.v,
      is_secret=excluded.is_secret,
      updated_at=excluded.updated_at
  `).bind(
    key,
    String(value ?? ""),
    Number(isSecret ? 1 : 0),
    now
  ).run();
}

async function loadPolicy(env){
  const raw = await getSetting(env, SETTINGS_KEY);
  if(!raw) return defaults();

  try{
    return normalizePayload(JSON.parse(raw));
  }catch{
    return defaults();
  }
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const value = await loadPolicy(env);

  return json(200, "ok", {
    key: SETTINGS_KEY,
    value
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const value = normalizePayload(body);

  await setSetting(env, SETTINGS_KEY, JSON.stringify(value), 0);

  return json(200, "ok", {
    saved: true,
    key: SETTINGS_KEY,
    value
  });
}

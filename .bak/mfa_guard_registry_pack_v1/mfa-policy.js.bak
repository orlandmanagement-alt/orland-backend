import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

const POLICY_KEY = "mfa_policy_v1";

function defaultPolicy(){
  return {
    enabled: 0,
    allow_user_opt_in: 0,
    require_for_super_admin: 0,
    require_for_security_admin: 0,
    require_for_admin: 0,
    allowed_types: ["app"],
    recovery_codes_enabled: 0
  };
}

function normalizePolicy(v){
  const src = v && typeof v === "object" ? v : {};
  const d = defaultPolicy();

  const allowed = Array.isArray(src.allowed_types)
    ? src.allowed_types.map(x => String(x || "").trim()).filter(Boolean)
    : d.allowed_types;

  return {
    enabled: src.enabled ? 1 : 0,
    allow_user_opt_in: src.allow_user_opt_in ? 1 : 0,
    require_for_super_admin: src.require_for_super_admin ? 1 : 0,
    require_for_security_admin: src.require_for_security_admin ? 1 : 0,
    require_for_admin: src.require_for_admin ? 1 : 0,
    allowed_types: allowed.length ? allowed : d.allowed_types,
    recovery_codes_enabled: src.recovery_codes_enabled ? 1 : 0
  };
}

async function readPolicy(env){
  try{
    const row = await env.DB.prepare(`
      SELECT v
      FROM system_settings
      WHERE k = ?
      LIMIT 1
    `).bind(POLICY_KEY).first();

    if(!row?.v) return defaultPolicy();
    return normalizePolicy(JSON.parse(row.v));
  }catch{
    return defaultPolicy();
  }
}

async function writePolicy(env, value){
  const now = nowSec();
  const payload = JSON.stringify(normalizePolicy(value));

  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, is_secret, updated_at)
    VALUES (?, ?, 0, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      is_secret = excluded.is_secret,
      updated_at = excluded.updated_at
  `).bind(POLICY_KEY, payload, now).run();

  return JSON.parse(payload);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin"])){
    return json(403, "forbidden", null);
  }

  return json(200, "ok", {
    key: POLICY_KEY,
    value: await readPolicy(env)
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const saved = await writePolicy(env, body);

  return json(200, "ok", {
    saved: true,
    key: POLICY_KEY,
    value: saved
  });
}

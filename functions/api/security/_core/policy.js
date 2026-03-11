import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

const POLICY_KEY = "security_policy";

function defaultPolicy(){
  return {
    rate_limit: {
      enabled: 1,
      window_sec: 60,
      max_requests: 120
    },
    lock_policy: {
      enabled: 1,
      max_fail: 6,
      lock_minutes: 15,
      exclude_roles: ["super_admin"]
    },
    headers: {
      enabled: 1
    }
  };
}

function toInt(v, d){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalizePolicy(v){
  const src = v && typeof v === "object" ? v : {};
  const d = defaultPolicy();

  const rate_limit = src.rate_limit && typeof src.rate_limit === "object" ? src.rate_limit : {};
  const lock_policy = src.lock_policy && typeof src.lock_policy === "object" ? src.lock_policy : {};
  const headers = src.headers && typeof src.headers === "object" ? src.headers : {};

  return {
    rate_limit: {
      enabled: rate_limit.enabled ? 1 : 0,
      window_sec: Math.max(1, toInt(rate_limit.window_sec, d.rate_limit.window_sec)),
      max_requests: Math.max(1, toInt(rate_limit.max_requests, d.rate_limit.max_requests))
    },
    lock_policy: {
      enabled: lock_policy.enabled ? 1 : 0,
      max_fail: Math.max(1, toInt(lock_policy.max_fail, d.lock_policy.max_fail)),
      lock_minutes: Math.max(1, toInt(lock_policy.lock_minutes, d.lock_policy.lock_minutes)),
      exclude_roles: Array.isArray(lock_policy.exclude_roles)
        ? lock_policy.exclude_roles.map(x => String(x || "").trim()).filter(Boolean)
        : d.lock_policy.exclude_roles
    },
    headers: {
      enabled: headers.enabled ? 1 : 0
    }
  };
}

async function readPolicy(env){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k = ?
    LIMIT 1
  `).bind(POLICY_KEY).first();

  if(!row?.v){
    return defaultPolicy();
  }

  try{
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

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const value = await readPolicy(env);

  return json(200, "ok", {
    key: POLICY_KEY,
    value
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
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

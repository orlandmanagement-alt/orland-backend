import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

const KEY = "security_policy_global";
const DEFAULT = {
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

async function getSetting(env){
  const row = await env.DB.prepare("SELECT v FROM system_settings WHERE k=? LIMIT 1").bind(KEY).first();
  if(!row?.v) return DEFAULT;
  try{
    const v = JSON.parse(row.v);
    return { ...DEFAULT, ...(v||{}) };
  }catch{
    return DEFAULT;
  }
}

async function setSetting(env, obj){
  const v = JSON.stringify(obj||DEFAULT);
  const t = nowSec();
  await env.DB.prepare(`
    INSERT INTO system_settings (k,v,is_secret,updated_at)
    VALUES (?,?,0,?)
    ON CONFLICT(k) DO UPDATE SET v=excluded.v, is_secret=0, updated_at=excluded.updated_at
  `).bind(KEY, v, t).run();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const v = await getSetting(env);
  return json(200,"ok",{ key: KEY, value: v });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  // accept partial updates
  const cur = await getSetting(env);
  const next = {
    ...cur,
    ...(body||{})
  };
  await setSetting(env, next);
  return json(200,"ok",{ saved:true, key: KEY, value: next });
}

import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

async function getSetting(env, k, fallback){
  const r = await env.DB.prepare("SELECT v FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
  return r ? String(r.v) : String(fallback);
}

async function setSetting(env, k, v){
  const now = nowSec();
  await env.DB.prepare("INSERT INTO system_settings (k,v,is_secret,updated_at) VALUES (?,?,0,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at")
    .bind(k, String(v), now).run();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const data = {
    rate_limit: {
      enabled: (await getSetting(env,"security.rate_limit.enabled","1")) === "1",
      max_per_min: Number(await getSetting(env,"security.rate_limit.max_per_min","120")),
      burst: Number(await getSetting(env,"security.rate_limit.burst","40")),
    },
    lock: {
      enabled: (await getSetting(env,"security.lock.enabled","1")) === "1",
      max_fail: Number(await getSetting(env,"security.lock.max_fail","7")),
      window_min: Number(await getSetting(env,"security.lock.window_min","15")),
      duration_min: Number(await getSetting(env,"security.lock.duration_min","30")),
    },
    headers: {
      enabled: (await getSetting(env,"security.headers.enabled","1")) === "1",
    }
  };

  return json(200,"ok",data);
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const rl = body.rate_limit || {};
  const lk = body.lock || {};
  const hd = body.headers || {};

  const enabled_rl = Number(rl.enabled ? 1 : 0);
  const max_per_min = Math.min(10000, Math.max(10, Number(rl.max_per_min||120)));
  const burst = Math.min(5000, Math.max(0, Number(rl.burst||40)));

  const enabled_lk = Number(lk.enabled ? 1 : 0);
  const max_fail = Math.min(50, Math.max(3, Number(lk.max_fail||7)));
  const window_min = Math.min(240, Math.max(1, Number(lk.window_min||15)));
  const duration_min = Math.min(1440, Math.max(1, Number(lk.duration_min||30)));

  const enabled_hd = Number(hd.enabled ? 1 : 0);

  await setSetting(env,"security.rate_limit.enabled", String(enabled_rl));
  await setSetting(env,"security.rate_limit.max_per_min", String(max_per_min));
  await setSetting(env,"security.rate_limit.burst", String(burst));

  await setSetting(env,"security.lock.enabled", String(enabled_lk));
  await setSetting(env,"security.lock.max_fail", String(max_fail));
  await setSetting(env,"security.lock.window_min", String(window_min));
  await setSetting(env,"security.lock.duration_min", String(duration_min));

  await setSetting(env,"security.headers.enabled", String(enabled_hd));

  return json(200,"ok",{ updated:true });
}

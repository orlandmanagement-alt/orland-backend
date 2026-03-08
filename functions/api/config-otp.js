import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function allow(a){ return hasRole(a.roles, ["super_admin","admin"]); }

async function getKV(env, k){
  const r = await env.DB.prepare(`SELECT v FROM system_settings WHERE k=? LIMIT 1`).bind(k).first();
  return r ? String(r.v||"") : "";
}
async function setKV(env, k, v){
  await env.DB.prepare(`
    INSERT INTO system_settings (k,v,is_secret,updated_at)
    VALUES (?,?,0,?)
    ON CONFLICT(k) DO UPDATE SET v=excluded.v, is_secret=0, updated_at=excluded.updated_at
  `).bind(k,String(v??""), nowSec()).run();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const enabled = (await getKV(env,"otp:enabled")) || "0";
  const provider = (await getKV(env,"otp:provider")) || "none";
  const config_json = (await getKV(env,"otp:config_json")) || "{}";

  return json(200,"ok",{ enabled:Number(enabled)||0, provider, config_json });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const enabled = body.enabled ? 1 : 0;
  const provider = String(body.provider||"none").trim();
  const config_json = typeof body.config_json === "string" ? body.config_json : JSON.stringify(body.config_json||{});

  await setKV(env,"otp:enabled", String(enabled));
  await setKV(env,"otp:provider", provider);
  await setKV(env,"otp:config_json", config_json);

  return json(200,"ok",{ updated:true });
}

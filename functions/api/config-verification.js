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

  const require_email = Number((await getKV(env,"verify:require_email"))||"0")||0;
  const require_phone = Number((await getKV(env,"verify:require_phone"))||"0")||0;
  const require_pin = Number((await getKV(env,"verify:require_pin"))||"0")||0;
  const require_ktp = Number((await getKV(env,"verify:require_ktp"))||"0")||0;
  const require_selfie = Number((await getKV(env,"verify:require_selfie"))||"0")||0;
  const config_json = (await getKV(env,"verify:config_json")) || "{}";

  return json(200,"ok",{ require_email, require_phone, require_pin, require_ktp, require_selfie, config_json });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  await setKV(env,"verify:require_email", body.require_email ? "1":"0");
  await setKV(env,"verify:require_phone", body.require_phone ? "1":"0");
  await setKV(env,"verify:require_pin", body.require_pin ? "1":"0");
  await setKV(env,"verify:require_ktp", body.require_ktp ? "1":"0");
  await setKV(env,"verify:require_selfie", body.require_selfie ? "1":"0");
  const config_json = typeof body.config_json === "string" ? body.config_json : JSON.stringify(body.config_json||{});
  await setKV(env,"verify:config_json", config_json);

  return json(200,"ok",{ updated:true });
}

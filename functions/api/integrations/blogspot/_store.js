import { nowSec } from "../../../_lib.js";

export async function getSetting(env, k){
  const r = await env.DB.prepare("SELECT v,is_secret FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
  return r ? { v: r.v, is_secret: Number(r.is_secret||0) } : null;
}

export async function setSetting(env, k, v, is_secret){
  const now = nowSec();
  const exists = await env.DB.prepare("SELECT 1 AS ok FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
  if(exists){
    await env.DB.prepare("UPDATE system_settings SET v=?, is_secret=?, updated_at=? WHERE k=?")
      .bind(String(v ?? ""), Number(is_secret||0), now, k).run();
  } else {
    await env.DB.prepare("INSERT INTO system_settings (k,v,is_secret,updated_at) VALUES (?,?,?,?)")
      .bind(k, String(v ?? ""), Number(is_secret||0), now).run();
  }
}

export async function getMany(env, keys){
  if(!keys.length) return {};
  const ph = keys.map(()=>"?").join(",");
  const r = await env.DB.prepare(`SELECT k,v,is_secret FROM system_settings WHERE k IN (${ph})`).bind(...keys).all();
  const out = {};
  for(const row of (r.results||[])){
    out[row.k] = { v: row.v, is_secret: Number(row.is_secret||0) };
  }
  return out;
}

export async function setMany(env, items){
  for(const it of items){
    await setSetting(env, it.k, it.v, it.is_secret);
  }
}

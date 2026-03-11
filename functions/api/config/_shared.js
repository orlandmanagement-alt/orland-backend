import { json, requireAuth, hasRole, readJson, nowSec } from "../../_lib.js";

export async function requireConfigAccess(env, request, write = false){
  const a = await requireAuth(env, request);
  if(!a.ok) return a;

  const allow = write
    ? hasRole(a.roles, ["super_admin","admin"])
    : hasRole(a.roles, ["super_admin","admin","staff"]);

  if(!allow){
    return {
      ok: false,
      res: json(403, "forbidden", null)
    };
  }

  return a;
}

export async function getSetting(env, k){
  const row = await env.DB.prepare(`
    SELECT v, is_secret, updated_at
    FROM system_settings
    WHERE k=?
    LIMIT 1
  `).bind(k).first();
  return row || null;
}

export async function setSetting(env, k, v, isSecret = 0){
  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, is_secret, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v=excluded.v,
      is_secret=excluded.is_secret,
      updated_at=excluded.updated_at
  `).bind(
    String(k),
    String(v ?? ""),
    Number(isSecret ? 1 : 0),
    nowSec()
  ).run();
}

export async function getJsonSetting(env, k, fallback = {}){
  const row = await getSetting(env, k);
  if(!row) return fallback;
  try{
    return JSON.parse(String(row.v || "{}"));
  }catch{
    return fallback;
  }
}

export async function setJsonSetting(env, k, obj, isSecret = 0){
  await setSetting(env, k, JSON.stringify(obj || {}), isSecret);
}

export function maskSecret(v){
  const s = String(v || "");
  if(!s) return "";
  if(s.length <= 6) return "******";
  return s.slice(0, 3) + "******" + s.slice(-3);
}

export async function readBody(request){
  return await readJson(request) || {};
}

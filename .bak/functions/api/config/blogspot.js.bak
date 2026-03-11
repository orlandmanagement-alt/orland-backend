import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";
import { getBlogspotConfig } from "../blogspot/_service.js";

async function setKV(env, k, v, is_secret = 0){
  await env.DB.prepare(`
    INSERT INTO system_settings (k,v,is_secret,updated_at)
    VALUES (?,?,?,?)
    ON CONFLICT(k) DO UPDATE SET
      v=excluded.v,
      is_secret=excluded.is_secret,
      updated_at=excluded.updated_at
  `).bind(k, String(v ?? ""), Number(is_secret || 0), nowSec()).run();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const cfg = await getBlogspotConfig(env);
  return json(200, "ok", cfg);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};

  await setKV(env, "blogspot_enabled", body.enabled ? "1" : "0", 0);
  await setKV(env, "blogspot_blog_id", String(body.blog_id || ""), 0);
  if(String(body.api_key || "").trim()){
    await setKV(env, "blogspot_api_key", String(body.api_key || "").trim(), 1);
  }

  return json(200, "ok", { saved:true });
}

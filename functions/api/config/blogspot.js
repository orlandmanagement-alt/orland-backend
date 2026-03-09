import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";
import { getBlogspotConfig, maskedConfig } from "../blogspot/_service.js";

async function setSetting(env, k, v, is_secret){
  const ts = nowSec();
  await env.DB.prepare(`
    INSERT INTO system_settings (k,v,is_secret,updated_at)
    VALUES (?,?,?,?)
    ON CONFLICT(k) DO UPDATE SET
      v=excluded.v,
      is_secret=excluded.is_secret,
      updated_at=excluded.updated_at
  `).bind(String(k), String(v ?? ""), Number(is_secret||0), ts).run();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const cfg = await getBlogspotConfig(env);
  return json(200,"ok", maskedConfig(cfg));
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const b = await readJson(request) || {};

  await setSetting(env, "blogspot_enabled", b.enabled ? "1" : "0", 0);
  await setSetting(env, "blogspot_blog_id", String(b.blog_id || "").trim(), 0);
  if(String(b.api_key || "").trim()) await setSetting(env, "blogspot_api_key", String(b.api_key).trim(), 1);
  await setSetting(env, "blogspot_client_id", String(b.client_id || "").trim(), 0);
  if(String(b.client_secret || "").trim()) await setSetting(env, "blogspot_client_secret", String(b.client_secret).trim(), 1);
  await setSetting(env, "blogspot_service_account", String(b.service_account || "").trim(), 0);

  return json(200,"ok",{ saved:true });
}

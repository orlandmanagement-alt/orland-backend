import { json } from "../../_lib.js";

export async function getSetting(env, k){
  const r = await env.DB.prepare("SELECT v FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
  return r ? String(r.v ?? "") : "";
}

export async function getBlogspotConfig(env){
  const enabled = await getSetting(env, "blogspot_enabled");
  const blog_id = await getSetting(env, "blogspot_blog_id");
  const api_key = await getSetting(env, "blogspot_api_key");
  const client_id = await getSetting(env, "blogspot_client_id");
  const client_secret = await getSetting(env, "blogspot_client_secret");
  const service_account = await getSetting(env, "blogspot_service_account");

  return {
    enabled: enabled === "1",
    blog_id,
    api_key,
    client_id,
    client_secret,
    service_account
  };
}

export function missingConfig(cfg){
  const miss = [];
  if(!cfg.blog_id) miss.push("blogspot_blog_id");
  if(!cfg.api_key) miss.push("blogspot_api_key");
  return miss;
}

export function bloggerUrl(path, params={}){
  const u = new URL("https://www.googleapis.com/blogger/v3/" + String(path||"").replace(/^\/+/,""));
  for(const [k,v] of Object.entries(params||{})){
    if(v !== undefined && v !== null && String(v) !== "") u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export async function bloggerFetch(url){
  const r = await fetch(url, { method:"GET" });
  const ct = r.headers.get("content-type") || "";
  if(ct.includes("application/json")){
    const j = await r.json().catch(()=>null);
    return { ok:r.ok, http:r.status, data:j };
  }
  const t = await r.text().catch(()=> "");
  return { ok:r.ok, http:r.status, data:{ raw:t } };
}

export function upstreamError(res){
  return json(502,"upstream_error",{ http:res.http, data:res.data || null });
}

export function maskedConfig(cfg){
  return {
    enabled: !!cfg.enabled,
    blog_id: cfg.blog_id || "",
    api_key_configured: !!cfg.api_key,
    client_id: cfg.client_id || "",
    client_secret_configured: !!cfg.client_secret,
    service_account: cfg.service_account || ""
  };
}

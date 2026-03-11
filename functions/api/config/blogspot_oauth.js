import { json, readJson } from "../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotOAuthConfig,
  setKV,
  getOAuthRedirectUri
} from "../blogspot/_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const oauth = await getBlogspotOAuthConfig(env);

  return json(200, "ok", {
    enabled: oauth.enabled,
    client_id_configured: oauth.client_id_configured,
    client_secret_configured: oauth.client_secret_configured,
    refresh_token_configured: oauth.refresh_token_configured,
    access_token_configured: oauth.access_token_configured,
    callback_url: getOAuthRedirectUri(request)
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};

  await setKV(env, "blogspot_oauth_enabled", body.enabled ? "1" : "0", 0);

  if(String(body.client_id || "").trim()){
    await setKV(env, "blogspot_client_id", String(body.client_id || "").trim(), 1);
  }

  if(String(body.client_secret || "").trim()){
    await setKV(env, "blogspot_client_secret", String(body.client_secret || "").trim(), 1);
  }

  if(body.clear_refresh_token){
    await setKV(env, "blogspot_refresh_token", "", 1);
    await setKV(env, "blogspot_access_token", "", 1);
    await setKV(env, "blogspot_token_exp_at", "0", 1);
  }

  return json(200, "ok", { saved:true });
}

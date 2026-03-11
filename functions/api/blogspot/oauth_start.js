import { json } from "../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotOAuthConfig,
  setKV,
  getOAuthRedirectUri
} from "./_service.js";

function makeState(){
  return crypto.randomUUID() + "_" + Date.now();
}

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const oauth = await getBlogspotOAuthConfig(env);
  if(!oauth.enabled){
    return json(400, "invalid_config", { error:"oauth_disabled" });
  }
  if(!oauth.client_id || !oauth.client_secret){
    return json(400, "invalid_config", { error:"oauth_client_missing" });
  }

  const state = makeState();
  await setKV(env, "blogspot_oauth_state", state, 1);

  const redirect_uri = getOAuthRedirectUri(request);
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", oauth.client_id);
  u.searchParams.set("redirect_uri", redirect_uri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "https://www.googleapis.com/auth/blogger");
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", state);

  return json(200, "ok", {
    authorize_url: u.toString(),
    callback_url: redirect_uri
  });
}

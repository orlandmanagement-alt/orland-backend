import { json } from "../../_lib.js";
import { requireConfigAccess, getSetting, setSetting, readBody, maskSecret } from "./_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireConfigAccess(env, request, false);
  if(!a.ok) return a.res;

  const clientId = await getSetting(env, "blogspot_oauth_client_id");
  const clientSecret = await getSetting(env, "blogspot_oauth_client_secret");
  const redirectUri = await getSetting(env, "blogspot_oauth_redirect_uri");

  return json(200, "ok", {
    client_id: String(clientId?.v || ""),
    client_secret_configured: !!String(clientSecret?.v || ""),
    client_secret_masked: maskSecret(clientSecret?.v || ""),
    redirect_uri: String(redirectUri?.v || "")
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireConfigAccess(env, request, true);
  if(!a.ok) return a.res;

  const body = await readBody(request);

  await setSetting(env, "blogspot_oauth_client_id", String(body.client_id || "").trim(), 0);
  await setSetting(env, "blogspot_oauth_redirect_uri", String(body.redirect_uri || "").trim(), 0);

  const secret = String(body.client_secret || "").trim();
  if(secret){
    await setSetting(env, "blogspot_oauth_client_secret", secret, 1);
  }

  return json(200, "ok", { saved: true });
}

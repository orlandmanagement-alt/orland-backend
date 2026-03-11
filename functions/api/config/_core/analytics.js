import { json } from "../../../_lib.js";
import { requireConfigAccess, getSetting, setSetting, readBody, maskSecret } from "../_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireConfigAccess(env, request, false);
  if(!a.ok) return a.res;

  const enabled = await getSetting(env, "analytics_enabled");
  const account = await getSetting(env, "cf_account_id");
  const zone = await getSetting(env, "cf_zone_tag");
  const token = await getSetting(env, "cf_api_token");

  return json(200, "ok", {
    enabled: String(enabled?.v || "0") === "1",
    cf_account_id: String(account?.v || ""),
    cf_zone_tag: String(zone?.v || ""),
    cf_api_token_configured: !!String(token?.v || ""),
    cf_api_token_masked: maskSecret(token?.v || "")
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireConfigAccess(env, request, true);
  if(!a.ok) return a.res;

  const body = await readBody(request);

  await setSetting(env, "analytics_enabled", body.enabled ? "1" : "0", 0);
  await setSetting(env, "cf_account_id", String(body.cf_account_id || "").trim(), 0);
  await setSetting(env, "cf_zone_tag", String(body.cf_zone_tag || "").trim(), 0);

  const token = String(body.cf_api_token || "").trim();
  if(token){
    await setSetting(env, "cf_api_token", token, 1);
  }

  return json(200, "ok", { saved: true });
}

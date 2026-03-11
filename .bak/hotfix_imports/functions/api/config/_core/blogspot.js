import { json } from "../../_lib.js";
import { requireConfigAccess, getSetting, setSetting, readBody, maskSecret } from "./_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireConfigAccess(env, request, false);
  if(!a.ok) return a.res;

  const enabled = await getSetting(env, "blogspot_enabled");
  const blogId = await getSetting(env, "blogspot_blog_id");
  const apiKey = await getSetting(env, "blogspot_api_key");

  return json(200, "ok", {
    enabled: String(enabled?.v || "0") === "1",
    blog_id: String(blogId?.v || ""),
    api_key_configured: !!String(apiKey?.v || ""),
    api_key_masked: maskSecret(apiKey?.v || "")
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireConfigAccess(env, request, true);
  if(!a.ok) return a.res;

  const body = await readBody(request);

  await setSetting(env, "blogspot_enabled", body.enabled ? "1" : "0", 0);
  await setSetting(env, "blogspot_blog_id", String(body.blog_id || "").trim(), 0);

  const apiKey = String(body.api_key || "").trim();
  if(apiKey){
    await setSetting(env, "blogspot_api_key", apiKey, 1);
  }

  return json(200, "ok", { saved: true });
}

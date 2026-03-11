import { json } from "../../../_lib.js";
import { requireConfigAccess, getJsonSetting, setJsonSetting, readBody } from "../_shared.js";

const KEY = "otp_config_v1";

function defaults(){
  return {
    enabled: 0,
    provider: "none",
    ttl_sec: 300,
    max_attempts: 5,
    resend_sec: 60
  };
}

export async function onRequestGet({ request, env }){
  const a = await requireConfigAccess(env, request, false);
  if(!a.ok) return a.res;

  const value = await getJsonSetting(env, KEY, defaults());
  return json(200, "ok", value);
}

export async function onRequestPost({ request, env }){
  const a = await requireConfigAccess(env, request, true);
  if(!a.ok) return a.res;

  const body = await readBody(request);
  const value = {
    enabled: body.enabled ? 1 : 0,
    provider: String(body.provider || "none").trim() || "none",
    ttl_sec: Math.max(60, Number(body.ttl_sec || 300)),
    max_attempts: Math.max(1, Number(body.max_attempts || 5)),
    resend_sec: Math.max(10, Number(body.resend_sec || 60))
  };

  await setJsonSetting(env, KEY, value, 0);
  return json(200, "ok", { saved: true, value });
}

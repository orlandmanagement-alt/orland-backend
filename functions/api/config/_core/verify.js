import { json } from "../../../_lib.js";
import { requireConfigAccess, getJsonSetting, setJsonSetting, readBody } from "../_shared.js";

const KEY = "verify_config_v1";

function defaults(){
  return {
    require_email: 0,
    require_phone: 0,
    require_pin: 0,
    require_ktp: 0,
    require_selfie: 0
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
    require_email: body.require_email ? 1 : 0,
    require_phone: body.require_phone ? 1 : 0,
    require_pin: body.require_pin ? 1 : 0,
    require_ktp: body.require_ktp ? 1 : 0,
    require_selfie: body.require_selfie ? 1 : 0
  };

  await setJsonSetting(env, KEY, value, 0);
  return json(200, "ok", { saved: true, value });
}

import { json, requireAuth } from "../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  return json(200,"ok",{ ts: Date.now() });
}

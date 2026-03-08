import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const user_id = String(body.user_id||"").trim();
  if(!user_id) return json(400,"invalid_input",null);

  await env.DB.prepare(`DELETE FROM system_settings WHERE k=?`).bind(`lockout:${user_id}`).run();
  await env.DB.prepare(`DELETE FROM system_settings WHERE k=?`).bind(`pwfail:${user_id}`).run(); // cleanup if any
  return json(200,"ok",{ unlocked:true, user_id, at: nowSec() });
}

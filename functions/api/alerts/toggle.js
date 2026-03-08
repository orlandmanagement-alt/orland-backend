import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  const enabled = Number(body.enabled ? 1 : 0);
  if(!id) return json(400,"invalid_input",null);

  await env.DB.prepare(`UPDATE alert_rules SET enabled=?, updated_at=? WHERE id=?`).bind(enabled, nowSec(), id).run();
  return json(200,"ok",{ updated:true });
}

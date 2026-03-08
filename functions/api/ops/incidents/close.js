import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",null);

  await env.DB.prepare(`UPDATE incidents SET status='closed', updated_at=? WHERE id=? AND status!='closed'`)
    .bind(nowSec(), id).run();

  return json(200,"ok",{ updated:true });
}

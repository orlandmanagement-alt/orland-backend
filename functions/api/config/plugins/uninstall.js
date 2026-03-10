import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id || "").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  await env.DB.prepare(`
    UPDATE plugins
    SET enabled=0, updated_at=?
    WHERE id=?
  `).bind(nowSec(), id).run();

  return json(200,"ok",{ uninstalled:true, id });
}

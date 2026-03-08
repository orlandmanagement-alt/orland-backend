import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",null);

  await env.DB.prepare(`DELETE FROM alert_rules WHERE id=?`).bind(id).run();
  return json(200,"ok",{ deleted:true });
}

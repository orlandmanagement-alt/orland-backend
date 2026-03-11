import { json, requireAuth, hasRole } from "../../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id, name, version, enabled, installed_at, updated_at
    FROM plugins
    ORDER BY name ASC, id ASC
  `).all();

  return json(200,"ok",{ items: r.results || [] });
}

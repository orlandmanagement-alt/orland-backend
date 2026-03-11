import { json } from "../../../_lib.js";
import { requireConfigAccess } from "../_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireConfigAccess(env, request, false);
  if(!a.ok) return a.res;

  const r = await env.DB.prepare(`
    SELECT id, name, version, enabled, installed_at, updated_at
    FROM plugins
    ORDER BY name ASC, updated_at DESC
  `).all();

  return json(200, "ok", {
    items: r.results || []
  });
}

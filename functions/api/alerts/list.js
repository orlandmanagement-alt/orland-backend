import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at
    FROM alert_rules
    ORDER BY updated_at DESC
    LIMIT 200
  `).all();

  return json(200,"ok",{ rows: r.results||[] });
}

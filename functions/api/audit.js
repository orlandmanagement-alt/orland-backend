import { json, requireAuth, hasRole } from "../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q")||"").trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||80)));

  const like = q ? `%${q}%` : null;

  const r = await env.DB.prepare(`
    SELECT id, actor_user_id, action, route, http_status, created_at
    FROM audit_logs
    WHERE ( ? IS NULL OR action LIKE ? OR route LIKE ? OR actor_user_id LIKE ? )
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(like, like, like, like, limit).all();

  return json(200,"ok",{ logs: r.results||[] });
}

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
    SELECT
      l.id, l.created_at, l.action, l.route, l.http_status,
      l.actor_user_id,
      u.display_name AS actor_name,
      u.email_norm AS actor_email
    FROM audit_logs l
    LEFT JOIN users u ON u.id=l.actor_user_id
    WHERE ( ? IS NULL OR l.action LIKE ? OR l.route LIKE ? OR l.actor_user_id LIKE ? )
    ORDER BY l.created_at DESC
    LIMIT ?
  `).bind(like, like, like, like, limit).all();

  return json(200,"ok",{ logs: r.results||[] });
}

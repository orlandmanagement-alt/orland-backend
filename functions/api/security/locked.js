import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"80")));
  const now = nowSec();

  const r = await env.DB.prepare(`
    SELECT id,email_norm,display_name,locked_until,lock_reason
    FROM users
    WHERE locked_until > ?
    ORDER BY locked_until DESC
    LIMIT ?
  `).bind(now, limit).all();

  return json(200,"ok",{ users: r.results || [] });
}

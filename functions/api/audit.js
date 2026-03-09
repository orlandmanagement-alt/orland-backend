import { json, requireAuth, hasRole } from "../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"80")));
  const q = String(url.searchParams.get("q")||"").trim();

  let rows;
  if(q){
    const like = `%${q}%`;
    rows = await env.DB.prepare(`
      SELECT id, actor_user_id, action, route, http_status, meta_json, created_at
      FROM audit_logs
      WHERE action LIKE ? OR route LIKE ? OR meta_json LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(like, like, like, limit).all();
  }else{
    rows = await env.DB.prepare(`
      SELECT id, actor_user_id, action, route, http_status, meta_json, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();
  }

  return json(200,"ok",{ logs: rows.results||[] });
}

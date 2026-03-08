import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  // only admin/staff/super_admin
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q")||"").trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||100)));

  // audit_logs columns: id, actor_user_id, action, target_type, target_id, meta_json, created_at
  // In our writer, meta_json may include route/http_status. We keep it flexible.
  if(!q){
    const r = await env.DB.prepare(`
      SELECT id, actor_user_id, action, target_id AS route, NULL AS http_status, meta_json, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();
    return json(200,"ok",{ rows: r.results||[] });
  }

  const like = `%${q}%`;
  const r = await env.DB.prepare(`
    SELECT id, actor_user_id, action, target_id AS route, NULL AS http_status, meta_json, created_at
    FROM audit_logs
    WHERE action LIKE ? OR target_id LIKE ? OR actor_user_id LIKE ? OR meta_json LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(like, like, like, like, limit).all();

  return json(200,"ok",{ rows: r.results||[] });
}

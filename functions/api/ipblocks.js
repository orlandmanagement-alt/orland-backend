import { json, requireAuth, hasRole } from "../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const mode = String(url.searchParams.get("mode") || "active").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "100")));

  let sql = "";
  if(mode === "all"){
    sql = `
      SELECT id, ip_hash, reason, expires_at, revoked_at, created_at, created_by_user_id
      FROM ip_blocks
      ORDER BY created_at DESC
      LIMIT ?
    `;
  } else {
    sql = `
      SELECT id, ip_hash, reason, expires_at, revoked_at, created_at, created_by_user_id
      FROM ip_blocks
      WHERE revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT ?
    `;
  }

  const r = await env.DB.prepare(sql).bind(limit).all();
  return json(200,"ok",{ items: r.results || [] });
}

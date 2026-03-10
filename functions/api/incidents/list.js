import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "").trim();
  const severity = String(url.searchParams.get("severity") || "").trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "50")));

  let sql = `
    SELECT
      id, severity, type, status, summary, details_json,
      created_at, updated_at, owner_user_id,
      acknowledged_by_user_id, closed_by_user_id
    FROM incidents
    WHERE 1=1
  `;
  const binds = [];

  if(status){
    sql += ` AND status=?`;
    binds.push(status);
  }
  if(severity){
    sql += ` AND severity=?`;
    binds.push(severity);
  }

  sql += ` ORDER BY updated_at DESC, created_at DESC LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();
  return json(200, "ok", { items: r.results || [] });
}

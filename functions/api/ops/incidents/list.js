import { json, requireAuth, hasRole } from "../../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status")||"open");
  const q = String(url.searchParams.get("q")||"").trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||80)));

  const where = [];
  const bind = [];

  if(status && status !== "all"){
    where.push("status=?");
    bind.push(status);
  }
  if(q){
    where.push("(id LIKE ? OR type LIKE ? OR summary LIKE ?)");
    const like = `%${q}%`;
    bind.push(like, like, like);
  }

  const sql = `
    SELECT id,severity,type,summary,status,owner_user_id,details_json,created_at,updated_at
    FROM incidents
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY updated_at DESC
    LIMIT ?
  `;
  bind.push(limit);

  const r = await env.DB.prepare(sql).bind(...bind).all();
  return json(200,"ok",{ rows: r.results||[] });
}

import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "50")));

  const allowedStatuses = ["pending","approved","rejected","verified"];
  const useStatus = allowedStatuses.includes(status) ? status : "";

  let sql = `
    SELECT
      uv.id,
      uv.user_id,
      uv.kind,
      uv.status,
      uv.evidence_json,
      uv.reviewed_by_user_id,
      uv.reviewed_at,
      uv.created_at,
      uv.updated_at,
      u.email_norm,
      u.display_name
    FROM user_verifications uv
    LEFT JOIN users u ON u.id = uv.user_id
    WHERE uv.kind='kyc'
  `;
  const bind = [];

  if(useStatus){
    sql += ` AND uv.status=? `;
    bind.push(useStatus);
  }

  if(q){
    sql += ` AND (
      LOWER(COALESCE(u.email_norm,'')) LIKE ?
      OR LOWER(COALESCE(u.display_name,'')) LIKE ?
      OR LOWER(COALESCE(uv.user_id,'')) LIKE ?
      OR LOWER(COALESCE(uv.id,'')) LIKE ?
    ) `;
    const like = "%" + q + "%";
    bind.push(like, like, like, like);
  }

  sql += ` ORDER BY uv.updated_at DESC, uv.created_at DESC LIMIT ? `;
  bind.push(limit);

  const r = await env.DB.prepare(sql).bind(...bind).all();

  const rows = (r.results || []).map(x => {
    let evidence = {};
    try{ evidence = JSON.parse(String(x.evidence_json || "{}")); }catch{}
    return {
      ...x,
      evidence
    };
  });

  return json(200, "ok", {
    items: rows,
    total: rows.length
  });
}

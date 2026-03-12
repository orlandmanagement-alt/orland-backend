import { json } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "").trim();
  const kind = String(url.searchParams.get("kind") || "").trim();
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "30")));

  let sql = `
    SELECT
      id, kind, local_id, remote_id, title, slug, reason,
      requested_by, requested_at,
      status,
      decided_by, decided_at, decision_note,
      executed_by, executed_at,
      result_status, result_message
    FROM blogspot_remote_delete_requests
    WHERE 1=1
  `;
  const binds = [];

  if(status){
    sql += ` AND status=?`;
    binds.push(status);
  }
  if(kind){
    sql += ` AND kind=?`;
    binds.push(kind);
  }

  sql += ` ORDER BY requested_at DESC LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      id: String(x.id || ""),
      kind: String(x.kind || ""),
      local_id: String(x.local_id || ""),
      remote_id: String(x.remote_id || ""),
      title: String(x.title || ""),
      slug: String(x.slug || ""),
      reason: String(x.reason || ""),
      requested_by: x.requested_by || null,
      requested_at: Number(x.requested_at || 0),
      status: String(x.status || "pending"),
      decided_by: x.decided_by || null,
      decided_at: Number(x.decided_at || 0),
      decision_note: String(x.decision_note || ""),
      executed_by: x.executed_by || null,
      executed_at: Number(x.executed_at || 0),
      result_status: String(x.result_status || ""),
      result_message: String(x.result_message || "")
    }))
  });
}

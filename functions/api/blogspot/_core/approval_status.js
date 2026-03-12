import { json } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const kind = String(url.searchParams.get("kind") || "").trim();
  const local_id = String(url.searchParams.get("local_id") || "").trim();

  let sql = `
    SELECT local_id, kind, title, slug, approval_status, approved_by, approved_at, sync_state, dirty
    FROM blogspot_post_map
    WHERE 1=1
  `;
  const binds = [];

  if(kind){
    sql += ` AND kind=?`;
    binds.push(kind);
  }
  if(local_id){
    sql += ` AND local_id=?`;
    binds.push(local_id);
  }

  sql += ` ORDER BY approval_status ASC, local_id ASC LIMIT 100`;

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      local_id: String(x.local_id || ""),
      kind: String(x.kind || ""),
      title: String(x.title || ""),
      slug: String(x.slug || ""),
      approval_status: String(x.approval_status || "not_required"),
      approved_by: x.approved_by || null,
      approved_at: Number(x.approved_at || 0),
      sync_state: String(x.sync_state || ""),
      dirty: Number(x.dirty || 0)
    }))
  });
}

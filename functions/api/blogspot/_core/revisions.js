import { json } from "../../../_lib.js";
import { requireRevisionAccess, safeJsonParse } from "./revision_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireRevisionAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const item_kind = String(url.searchParams.get("item_kind") || "").trim().toLowerCase();
  const item_id = String(url.searchParams.get("item_id") || "").trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "50")));

  let sql = `
    SELECT
      id, item_kind, item_id, revision_no, source_action, actor_user_id,
      title, slug, status, snapshot_json, note, created_at
    FROM blogspot_revision_history
    WHERE 1=1
  `;
  const binds = [];

  if(item_kind){
    sql += ` AND item_kind=?`;
    binds.push(item_kind);
  }
  if(item_id){
    sql += ` AND item_id=?`;
    binds.push(item_id);
  }

  sql += ` ORDER BY created_at DESC, revision_no DESC LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      id: String(x.id || ""),
      item_kind: String(x.item_kind || ""),
      item_id: String(x.item_id || ""),
      revision_no: Number(x.revision_no || 0),
      source_action: String(x.source_action || ""),
      actor_user_id: x.actor_user_id || null,
      title: String(x.title || ""),
      slug: String(x.slug || ""),
      status: String(x.status || ""),
      snapshot_json: safeJsonParse(x.snapshot_json, {}),
      note: String(x.note || ""),
      created_at: Number(x.created_at || 0)
    }))
  });
}

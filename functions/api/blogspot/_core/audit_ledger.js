import { json } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const site_id = String(url.searchParams.get("site_id") || "").trim();
  const event_type = String(url.searchParams.get("event_type") || "").trim().toLowerCase();
  const item_kind = String(url.searchParams.get("item_kind") || "").trim().toLowerCase();
  const item_id = String(url.searchParams.get("item_id") || "").trim();
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || "100")));

  let sql = `
    SELECT
      id, site_id, event_type, item_kind, item_id,
      actor_user_id, payload_json, prev_hash, entry_hash, created_at
    FROM blogspot_audit_ledger
    WHERE 1=1
  `;
  const binds = [];

  if(site_id){
    sql += ` AND site_id=?`;
    binds.push(site_id);
  }
  if(event_type){
    sql += ` AND lower(event_type)=?`;
    binds.push(event_type);
  }
  if(item_kind){
    sql += ` AND lower(item_kind)=?`;
    binds.push(item_kind);
  }
  if(item_id){
    sql += ` AND item_id=?`;
    binds.push(item_id);
  }

  sql += ` ORDER BY created_at DESC, id DESC LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      id: String(x.id || ""),
      site_id: x.site_id || null,
      event_type: String(x.event_type || ""),
      item_kind: x.item_kind || null,
      item_id: x.item_id || null,
      actor_user_id: x.actor_user_id || null,
      payload_json: (() => {
        try{ return JSON.parse(String(x.payload_json || "{}")); }
        catch{ return {}; }
      })(),
      prev_hash: String(x.prev_hash || ""),
      entry_hash: String(x.entry_hash || ""),
      created_at: Number(x.created_at || 0)
    })),
    total: (r.results || []).length
  });
}
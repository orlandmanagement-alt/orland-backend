import { json } from "../../_lib.js";
import { requireBlogspotAccess } from "./_core/_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "30")));
  const status = String(url.searchParams.get("status") || "").trim();
  const kind = String(url.searchParams.get("kind") || "").trim();
  const direction = String(url.searchParams.get("direction") || "").trim();

  let sql = `
    SELECT
      id,
      direction,
      kind,
      local_id,
      remote_id,
      action,
      status,
      message,
      payload_json,
      created_at
    FROM blogspot_sync_logs
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
  if(direction){
    sql += ` AND direction=?`;
    binds.push(direction);
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      ...x,
      payload_json: (() => {
        try{ return JSON.parse(String(x.payload_json || "{}")); }
        catch{ return {}; }
      })()
    })),
    total: (r.results || []).length
  });
}

import { json } from "../../_lib.js";
import { requireBlogspotAccess, safeJsonParse } from "./_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const section = String(url.searchParams.get("section") || "").trim();

  let sql = `
    SELECT id, section, title, payload_json, sort_order, status, updated_at
    FROM blogspot_widget_home
    WHERE status='active'
  `;
  const binds = [];

  if(section){
    sql += ` AND section=?`;
    binds.push(section);
  }

  sql += ` ORDER BY sort_order ASC, updated_at DESC`;

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      ...x,
      payload_json: safeJsonParse(x.payload_json, {})
    }))
  });
}

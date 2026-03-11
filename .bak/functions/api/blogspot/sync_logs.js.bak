import { json } from "../../_lib.js";
import { requireBlogspotAccess, safeJsonParse } from "./_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || "20")));

  const r = await env.DB.prepare(`
    SELECT id, direction, kind, local_id, remote_id, action, status, message, payload_json, created_at
    FROM blogspot_sync_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      ...x,
      payload_json: safeJsonParse(x.payload_json, {})
    }))
  });
}

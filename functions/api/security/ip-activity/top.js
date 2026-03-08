import { json, requireAuth } from "../../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const kind = String(url.searchParams.get("kind") || "api_rq");
  const minutes = Math.max(5, Math.min(24*60, Number(url.searchParams.get("minutes") || 240)));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 20)));

  const since = Math.floor(Date.now()/1000) - (minutes*60);

  // group by ip_hash
  const r = await env.DB.prepare(`
    SELECT ip_hash, SUM(cnt) AS total, MAX(updated_at) AS last_seen_at
    FROM ip_activity
    WHERE kind=? AND window_start >= ?
    GROUP BY ip_hash
    ORDER BY total DESC
    LIMIT ?
  `).bind(kind, since, limit).all();

  return json(200,"ok",{ rows: r.results || [] });
}

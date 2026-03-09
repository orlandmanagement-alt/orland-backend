import { json, requireAuth, hasRole } from "../../_lib.js";

async function getSetting(env, k){
  const r = await env.DB.prepare("SELECT v FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
  return r ? String(r.v ?? "") : "";
}

function clamp(n, a, b){
  n = Number(n);
  if (!Number.isFinite(n)) n = a;
  return Math.max(a, Math.min(b, n));
}

/**
 * GET /api/analytics/visitors?minutes=60
 * Requires: system_settings keys
 * - cf_analytics_enabled (0/1)
 * - cf_analytics_zone_tag
 * - cf_analytics_token (secret)
 */
export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const enabled = await getSetting(env, "cf_analytics_enabled");
  if(enabled !== "1") return json(200,"ok",{ enabled:false });

  const zoneTag = await getSetting(env, "cf_analytics_zone_tag");
  const token = await getSetting(env, "cf_analytics_token");
  if(!zoneTag || !token) return json(400,"invalid_config",{ message:"missing_zone_or_token" });

  const url = new URL(request.url);
  const minutes = clamp(url.searchParams.get("minutes") || 60, 5, 240);

  // cache 30s (prevent spam)
  const cacheKey = new Request("https://cache.local/api/analytics/visitors?minutes="+minutes, { method:"GET" });
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if(hit) return hit;

  // Cloudflare Analytics GraphQL
  const query = `
    query($zoneTag: string, $limit: int) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1mGroups(limit: $limit, orderBy: [datetime_ASC]) {
            dimensions { datetime }
            sum { requests }
            uniq { uniques }
          }
        }
      }
    }
  `;

  const gqlRes = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer " + token
    },
    body: JSON.stringify({
      query,
      variables: { zoneTag, limit: minutes }
    })
  });

  if(!gqlRes.ok){
    const t = await gqlRes.text().catch(()=> "");
    return json(502,"upstream_error",{ http:gqlRes.status, body:t.slice(0,400) });
  }

  const payload = await gqlRes.json().catch(()=>null);
  if(!payload || payload.errors){
    return json(502,"upstream_error",{ message:"graphql_error", errors: payload?.errors || null });
  }

  const groups = payload?.data?.viewer?.zones?.[0]?.httpRequests1mGroups || [];
  const series = groups.map(g => ({
    t: g?.dimensions?.datetime || null,
    requests: Number(g?.sum?.requests || 0),
    uniques: Number(g?.uniq?.uniques || 0)
  })).filter(x => x.t);

  const total_requests = series.reduce((a,x)=>a+x.requests,0);
  const total_uniques = series.reduce((a,x)=>a+x.uniques,0);
  const last = series.length ? series[series.length-1] : null;

  const out = json(200,"ok",{
    enabled:true,
    minutes,
    last,
    total_requests,
    total_uniques,
    series
  });

  out.headers.set("cache-control","public, max-age=30");
  await cache.put(cacheKey, out.clone());
  return out;
}

import { json, requireAuth, hasRole } from "../../_lib.js";
import { cfQuery, getCfConfig } from "_cf.js";

async function tryQuery(env, zoneTag, query){
  const data = await cfQuery(env, query, { zoneTag });
  if(data && data.__orland_response){
    return { failed: true, response: data.__orland_response };
  }
  return { failed: false, data };
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin","staff"])){
    return json(403, "forbidden", null);
  }

  const cfg = await getCfConfig(env);

  if(!cfg.enabled){
    return json(200, "ok", { enabled:false });
  }

  if(!cfg.zone){
    return json(200, "ok", {
      enabled:true,
      configured:false,
      upstream_ok:false,
      message:"missing_zone_tag"
    });
  }

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get("days") || "7")));

  const primaryQuery = `
    query($zoneTag: String!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(limit: ${days}, orderBy: [date_DESC]) {
            dimensions { date }
            sum {
              requests
              pageViews
              bytes
              cachedRequests
              cachedBytes
              threats
            }
          }
        }
      }
    }
  `;

  const fallbackQuery = `
    query($zoneTag: String!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(limit: ${days}) {
            dimensions { date }
            sum {
              requests
              pageViews
              bytes
              cachedRequests
              cachedBytes
              threats
            }
          }
        }
      }
    }
  `;

  let result = await tryQuery(env, cfg.zone, primaryQuery);

  if(result.failed){
    result = await tryQuery(env, cfg.zone, fallbackQuery);
    if(result.failed){
      return json(200, "ok", {
        enabled:true,
        configured:true,
        upstream_ok:false,
        items:[],
        message:"overview_query_failed"
      });
    }
  }

  const items =
    result.data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ||
    [];

  return json(200, "ok", {
    enabled:true,
    configured:true,
    upstream_ok:true,
    items
  });
}

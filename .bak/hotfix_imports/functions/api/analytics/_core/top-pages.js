import { json } from "../../_lib.js";
import {
  requireAnalyticsAccess,
  getAnalyticsConfig,
  analyticsDisabled,
  analyticsMissingConfig,
  cfGraphql
} from "./_core/_cf.js";

export async function onRequestGet({ request, env }){
  const a = await requireAnalyticsAccess(env, request);
  if(!a.ok) return a.res;

  const cfg = await getAnalyticsConfig(env);
  if(!cfg.enabled) return analyticsDisabled();
  if(!cfg.configured) return analyticsMissingConfig();

  const query = `
    query TopPages($zoneTag: string!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1mGroups(
            limit: 10
            orderBy: [sum_requests_DESC]
          ) {
            dimensions {
              clientRequestPath
            }
            sum {
              requests
            }
          }
        }
      }
    }
  `;

  const r = await cfGraphql(env, query, {
    zoneTag: cfg.zone_tag
  });

  if(!r.ok){
    return json(200, "ok", {
      enabled: true,
      configured: true,
      upstream_ok: false,
      items: [],
      kind: r.kind,
      message: "top_pages_query_failed"
    });
  }

  const items = r.data?.data?.viewer?.zones?.[0]?.httpRequests1mGroups || [];

  return json(200, "ok", {
    enabled: true,
    configured: true,
    upstream_ok: true,
    items
  });
}

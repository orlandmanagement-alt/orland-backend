import { json } from "../../_lib.js";
import {
  requireAnalyticsAccess,
  getAnalyticsConfig,
  analyticsDisabled,
  analyticsMissingConfig,
  cfGraphql,
  rangeDates
} from "./_cf.js";

export async function onRequestGet({ request, env }){
  const a = await requireAnalyticsAccess(env, request);
  if(!a.ok) return a.res;

  const cfg = await getAnalyticsConfig(env);
  if(!cfg.enabled) return analyticsDisabled();
  if(!cfg.configured) return analyticsMissingConfig();

  const url = new URL(request.url);
  const { days, dateStart, dateEnd } = rangeDates(url.searchParams.get("days") || 7);

  const query = `
    query Visitors($zoneTag: string!, $dateStart: Date!, $dateEnd: Date!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 100
            orderBy: [date_ASC]
            filter: { date_geq: $dateStart, date_leq: $dateEnd }
          ) {
            dimensions { date }
            uniq {
              uniques
            }
            sum {
              requests
              pageViews
            }
          }
        }
      }
    }
  `;

  const r = await cfGraphql(env, query, {
    zoneTag: cfg.zone_tag,
    dateStart,
    dateEnd
  });

  if(!r.ok){
    return json(200, "ok", {
      enabled: true,
      configured: true,
      upstream_ok: false,
      items: [],
      kind: r.kind,
      message: "visitors_query_failed"
    });
  }

  const items = r.data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];

  return json(200, "ok", {
    enabled: true,
    configured: true,
    upstream_ok: true,
    days,
    items
  });
}

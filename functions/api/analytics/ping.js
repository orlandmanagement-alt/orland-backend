import { json } from "../../_lib.js";
import {
  requireAnalyticsAccess,
  getAnalyticsConfig,
  analyticsDisabled,
  analyticsMissingConfig,
  cfGraphql
} from "./_cf.js";

export async function onRequestGet({ request, env }){
  const a = await requireAnalyticsAccess(env, request);
  if(!a.ok) return a.res;

  const cfg = await getAnalyticsConfig(env);
  if(!cfg.enabled) return analyticsDisabled();
  if(!cfg.configured) return analyticsMissingConfig();

  const q = `
    query PingZone($accountTag: String!, $zoneTag: string!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          zones(filter: { zoneTag: $zoneTag }) {
            zoneTag
          }
        }
      }
    }
  `;

  const r = await cfGraphql(env, q, {
    accountTag: cfg.account_id,
    zoneTag: cfg.zone_tag
  });

  if(!r.ok){
    return json(200, "ok", {
      enabled: true,
      configured: true,
      upstream_ok: false,
      kind: r.kind,
      message: "ping_failed"
    });
  }

  const zones = r.data?.data?.viewer?.accounts?.[0]?.zones || [];

  return json(200, "ok", {
    enabled: true,
    configured: true,
    upstream_ok: true,
    zones_found: zones.length
  });
}

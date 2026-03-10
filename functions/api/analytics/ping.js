import { json, requireAuth, hasRole } from "../../_lib.js";
import { getCfConfig } from "_cf.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin","staff"])){
    return json(403, "forbidden", null);
  }

  const cfg = await getCfConfig(env);

  if(!cfg.enabled){
    return json(200, "ok", {
      enabled: false,
      configured: false,
      upstream_ok: false,
      message: "analytics_disabled"
    });
  }

  if(!cfg.account || !cfg.zone || !cfg.token){
    return json(200, "ok", {
      enabled: true,
      configured: false,
      upstream_ok: false,
      message: "missing_cloudflare_config",
      has_account: !!cfg.account,
      has_zone: !!cfg.zone,
      has_token: !!cfg.token
    });
  }

  const query = `
    query($zoneTag: String!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(limit: 1) {
            dimensions { date }
            sum { requests }
          }
        }
      }
    }
  `;

  try{
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + cfg.token
      },
      body: JSON.stringify({
        query,
        variables: {
          zoneTag: cfg.zone
        }
      })
    });

    const data = await res.json();

    if(!res.ok){
      return json(200, "ok", {
        enabled: true,
        configured: true,
        upstream_ok: false,
        http_status: res.status,
        body: data
      });
    }

    if(data && data.errors && data.errors.length){
      return json(200, "ok", {
        enabled: true,
        configured: true,
        upstream_ok: false,
        body: data
      });
    }

    const rows = data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];

    return json(200, "ok", {
      enabled: true,
      configured: true,
      upstream_ok: true,
      message: "cloudflare_token_valid",
      rows
    });
  }catch(e){
    return json(200, "ok", {
      enabled: true,
      configured: true,
      upstream_ok: false,
      message: String(e?.message || e)
    });
  }
}

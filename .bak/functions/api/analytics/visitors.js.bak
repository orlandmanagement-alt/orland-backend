import { json, requireAuth, hasRole } from "../../_lib.js";

async function getKV(env, k){
  const row = await env.DB.prepare(`SELECT v FROM system_settings WHERE k=? LIMIT 1`).bind(k).first();
  return row ? String(row.v || "") : "";
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const enabled = await getKV(env, "analytics_enabled");
  const account_id = await getKV(env, "cf_account_id");
  const zone_tag = await getKV(env, "cf_zone_tag");
  const token = await getKV(env, "cf_api_token");
  const dataset = await getKV(env, "cf_dataset") || "httpRequests1dGroups";

  if(enabled !== "1"){
    return json(200,"ok",{ enabled:false });
  }

  if(!account_id || !zone_tag || !token){
    return json(200,"ok",{ enabled:true, configured:false, message:"missing_cloudflare_config" });
  }

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get("days") || "7")));

  const query = {
    query: `
      query VisitorQuery($accountTag: String!, $zoneTag: String!, $limit: Int!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            zones(filter: { zoneTag: $zoneTag }) {
              ${dataset}(limit: $limit) {
                dimensions { date }
                sum {
                  requests
                  pageViews
                  bytes
                }
              }
            }
          }
        }
      }
    `,
    variables: {
      accountTag: account_id,
      zoneTag: zone_tag,
      limit: days
    }
  };

  try{
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + token
      },
      body: JSON.stringify(query)
    });

    const data = await res.json();

    if(!res.ok){
      return json(200,"ok",{
        enabled:true,
        configured:true,
        upstream_ok:false,
        http_status: res.status,
        body: data
      });
    }

    const rows =
      data?.data?.viewer?.accounts?.[0]?.zones?.[0]?.[dataset] || [];

    const visitors = rows.map(x => ({
      day: x?.dimensions?.date || "",
      requests: Number(x?.sum?.requests || 0),
      pageViews: Number(x?.sum?.pageViews || 0),
      bytes: Number(x?.sum?.bytes || 0)
    }));

    return json(200,"ok",{
      enabled:true,
      configured:true,
      upstream_ok:true,
      visitors
    });
  }catch(e){
    return json(200,"ok",{
      enabled:true,
      configured:true,
      upstream_ok:false,
      message:String(e?.message || e)
    });
  }
}

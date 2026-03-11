import { json, requireAuth, hasRole } from "../../../_lib.js";

async function getSetting(env, k){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k=?
    LIMIT 1
  `).bind(k).first();
  return row ? String(row.v || "") : "";
}

export async function requireAnalyticsAccess(env, request){
  const a = await requireAuth(env, request);
  if(!a.ok) return a;

  if(!hasRole(a.roles, ["super_admin","admin","staff"])){
    return {
      ok: false,
      res: json(403, "forbidden", null)
    };
  }

  return a;
}

export async function getAnalyticsConfig(env){
  const enabled = await getSetting(env, "analytics_enabled");
  const account_id = await getSetting(env, "cf_account_id");
  const zone_tag = await getSetting(env, "cf_zone_tag");
  const api_token = await getSetting(env, "cf_api_token");

  return {
    enabled: enabled === "1",
    account_id,
    zone_tag,
    api_token,
    configured: !!(account_id && zone_tag && api_token)
  };
}

export function analyticsDisabled(){
  return json(200, "ok", {
    enabled: false,
    configured: false,
    upstream_ok: false,
    items: [],
    message: "analytics_disabled"
  });
}

export function analyticsMissingConfig(){
  return json(200, "ok", {
    enabled: true,
    configured: false,
    upstream_ok: false,
    items: [],
    message: "missing_analytics_config"
  });
}

export async function cfGraphql(env, query, variables = {}){
  const cfg = await getAnalyticsConfig(env);

  if(!cfg.enabled){
    return {
      ok: false,
      kind: "disabled",
      cfg,
      status: 200,
      data: null
    };
  }

  if(!cfg.configured){
    return {
      ok: false,
      kind: "missing_config",
      cfg,
      status: 200,
      data: null
    };
  }

  try{
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + cfg.api_token
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const ct = res.headers.get("content-type") || "";
    const raw = ct.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => "");

    if(!res.ok){
      return {
        ok: false,
        kind: "http_error",
        cfg,
        status: res.status,
        data: raw
      };
    }

    if(raw?.errors?.length){
      return {
        ok: false,
        kind: "graphql_error",
        cfg,
        status: 502,
        data: raw
      };
    }

    return {
      ok: true,
      kind: "ok",
      cfg,
      status: 200,
      data: raw
    };
  }catch(e){
    return {
      ok: false,
      kind: "network_error",
      cfg,
      status: 500,
      data: {
        error: String(e?.message || e)
      }
    };
  }
}

export function rangeDates(days){
  const n = Math.max(1, Math.min(30, Number(days || 7)));
  const end = new Date();
  const start = new Date(Date.now() - ((n - 1) * 86400000));

  const toYmd = (d)=>{
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const da = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };

  return {
    days: n,
    dateStart: toYmd(start),
    dateEnd: toYmd(end)
  };
}

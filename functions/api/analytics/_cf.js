import { json } from "../../_lib.js";

async function getKV(env, k){
  const row = await env.DB.prepare(
    "SELECT v FROM system_settings WHERE k=? LIMIT 1"
  ).bind(k).first();
  return row ? String(row.v || "") : "";
}

export async function getCfConfig(env){
  const enabled = await getKV(env, "analytics_enabled");
  const account = await getKV(env, "cf_account_id");
  const zone = await getKV(env, "cf_zone_tag");
  const token = await getKV(env, "cf_api_token");

  return {
    enabled: enabled === "1",
    account,
    zone,
    token
  };
}

export async function cfQuery(env, query, variables){
  const cfg = await getCfConfig(env);

  if(!cfg.enabled){
    return { __orland_response: json(200, "ok", { enabled:false }) };
  }

  if(!cfg.account || !cfg.zone || !cfg.token){
    return {
      __orland_response: json(200, "ok", {
        enabled: true,
        configured: false,
        message: "missing_cloudflare_config"
      })
    };
  }

  const res = await fetch(
    "https://api.cloudflare.com/client/v4/graphql",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + cfg.token
      },
      body: JSON.stringify({
        query,
        variables
      })
    }
  );

  const data = await res.json();

  if(!res.ok){
    return {
      __orland_response: json(200, "ok", {
        enabled: true,
        configured: true,
        upstream_ok: false,
        http_status: res.status,
        body: data
      })
    };
  }

  if(data && data.errors && data.errors.length){
    return {
      __orland_response: json(200, "ok", {
        enabled: true,
        configured: true,
        upstream_ok: false,
        body: data
      })
    };
  }

  return data;
}

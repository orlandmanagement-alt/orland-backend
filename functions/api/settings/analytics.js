import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function getKV(env, k){
  const row = await env.DB.prepare(`SELECT v FROM system_settings WHERE k=? LIMIT 1`).bind(k).first();
  return row ? String(row.v || "") : "";
}

async function setKV(env, k, v){
  await env.DB.prepare(`
    INSERT INTO system_settings (k,v,updated_at)
    VALUES (?,?,?)
    ON CONFLICT(k) DO UPDATE SET
      v=excluded.v,
      updated_at=excluded.updated_at
  `).bind(k, String(v ?? ""), nowSec()).run();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const enabled = await getKV(env, "analytics_enabled");
  const account_id = await getKV(env, "cf_account_id");
  const zone_tag = await getKV(env, "cf_zone_tag");
  const token = await getKV(env, "cf_api_token");
  const dataset = await getKV(env, "cf_dataset");

  return json(200,"ok",{
    enabled: enabled === "1",
    account_id,
    zone_tag,
    dataset: dataset || "httpRequests1dGroups",
    token_configured: !!token
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};

  await setKV(env, "analytics_enabled", body.enabled ? "1" : "0");
  await setKV(env, "cf_account_id", String(body.account_id || ""));
  await setKV(env, "cf_zone_tag", String(body.zone_tag || ""));
  await setKV(env, "cf_dataset", String(body.dataset || "httpRequests1dGroups"));

  if(String(body.token || "").trim()){
    await setKV(env, "cf_api_token", String(body.token || "").trim());
  }

  return json(200,"ok",{ saved:true });
}

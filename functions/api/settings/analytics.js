import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function getSetting(env, k){
  const r = await env.DB.prepare("SELECT v,is_secret FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
  if(!r) return null;
  return { v: String(r.v ?? ""), is_secret: Number(r.is_secret||0) };
}

async function setSetting(env, k, v, is_secret){
  const ts = nowSec();
  await env.DB.prepare(`
    INSERT INTO system_settings (k,v,is_secret,updated_at)
    VALUES (?,?,?,?)
    ON CONFLICT(k) DO UPDATE SET v=excluded.v, is_secret=excluded.is_secret, updated_at=excluded.updated_at
  `).bind(String(k), String(v ?? ""), Number(is_secret||0), ts).run();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const enabled = await getSetting(env, "cf_analytics_enabled");
  const zoneTag = await getSetting(env, "cf_analytics_zone_tag");
  const accountId = await getSetting(env, "cf_analytics_account_id");
  const token = await getSetting(env, "cf_analytics_token");

  return json(200,"ok",{
    enabled: (enabled?.v === "1"),
    account_id: accountId?.v || "",
    zone_tag: zoneTag?.v || "",
    token_configured: !!(token?.v),
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const enabled = body.enabled ? "1" : "0";
  const zone_tag = String(body.zone_tag || "").trim();
  const account_id = String(body.account_id || "").trim();
  const token = String(body.token || "").trim(); // optional

  if(enabled === "1" && !zone_tag) return json(400,"invalid_input",{ message:"zone_tag_required" });

  await setSetting(env, "cf_analytics_enabled", enabled, 0);
  await setSetting(env, "cf_analytics_zone_tag", zone_tag, 0);
  await setSetting(env, "cf_analytics_account_id", account_id, 0);

  // Only update token when provided (avoid wiping)
  if(token) await setSetting(env, "cf_analytics_token", token, 1);

  return json(200,"ok",{ saved:true });
}

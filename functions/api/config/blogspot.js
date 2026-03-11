import { json, readJson, nowSec } from "../../_lib.js";
import { requireBlogspotAccess, getBlogspotConfig } from "../blogspot/_service.js";

async function setKV(env, k, v, is_secret = 0){
  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, is_secret, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      is_secret = excluded.is_secret,
      updated_at = excluded.updated_at
  `).bind(k, String(v ?? ""), is_secret ? 1 : 0, nowSec()).run();
}

async function getCfg(env, k, fallback = ""){
  const row = await env.DB.prepare(`SELECT v FROM blogspot_sync_config WHERE k=? LIMIT 1`).bind(k).first();
  return row ? String(row.v || "") : fallback;
}

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const cfg = await getBlogspotConfig(env);

  return json(200, "ok", {
    ...cfg,
    sync: {
      enabled: (await getCfg(env, "enabled", "0")) === "1",
      auto_sync_enabled: (await getCfg(env, "auto_sync_enabled", "0")) === "1",
      sync_interval_min: Number(await getCfg(env, "sync_interval_min", "15")),
      sync_posts_enabled: (await getCfg(env, "sync_posts_enabled", "1")) !== "0",
      sync_pages_enabled: (await getCfg(env, "sync_pages_enabled", "1")) !== "0",
      sync_widgets_enabled: (await getCfg(env, "sync_widgets_enabled", "1")) !== "0",
      sync_direction: await getCfg(env, "sync_direction", "bidirectional"),
      cron_driver: await getCfg(env, "cron_driver", "cron_trigger"),
      cron_endpoint: await getCfg(env, "cron_endpoint", "")
    }
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};

  await setKV(env, "blogspot_enabled", body.enabled ? "1" : "0", 0);
  await setKV(env, "blogspot_blog_id", String(body.blog_id || ""), 0);

  if(String(body.api_key || "").trim()){
    await setKV(env, "blogspot_api_key", String(body.api_key || "").trim(), 1);
  }

  return json(200, "ok", { saved:true });
}

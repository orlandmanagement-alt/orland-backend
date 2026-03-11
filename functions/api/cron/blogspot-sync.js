import { json, nowSec } from "../../_lib.js";
import { getBlogspotConfig } from "../blogspot/_service.js";

async function getCfg(env, k){
  const row = await env.DB.prepare(
    "SELECT v FROM blogspot_sync_config WHERE k=? LIMIT 1"
  ).bind(k).first();
  return row ? String(row.v || "") : "";
}

async function getState(env, k){
  const row = await env.DB.prepare(
    "SELECT v FROM blogspot_sync_state WHERE k=? LIMIT 1"
  ).bind(k).first();
  return row ? String(row.v || "") : "";
}

async function setState(env, k, v){
  await env.DB.prepare(`
    INSERT INTO blogspot_sync_state (k, v, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      updated_at = excluded.updated_at
  `).bind(k, String(v ?? ""), nowSec()).run();
}

async function addLog(env, row){
  await env.DB.prepare(`
    INSERT INTO blogspot_sync_logs (
      id, direction, kind, local_id, remote_id, action, status, message, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    String(row.direction || "system"),
    String(row.kind || "system"),
    row.local_id || null,
    row.remote_id || null,
    String(row.action || "cron"),
    String(row.status || "ok"),
    row.message || "",
    JSON.stringify(row.payload_json || {}),
    nowSec()
  ).run();
}

async function countOne(env, sql, binds = []){
  const row = await env.DB.prepare(sql).bind(...binds).first();
  return Number(row?.total || 0);
}

async function buildSummary(env){
  const sync_direction = await getCfg(env, "sync_direction");
  const sync_posts_enabled = await getCfg(env, "sync_posts_enabled");
  const sync_pages_enabled = await getCfg(env, "sync_pages_enabled");
  const sync_widgets_enabled = await getCfg(env, "sync_widgets_enabled");
  const cron_driver = await getCfg(env, "cron_driver");

  const posts_dirty = sync_posts_enabled !== "0"
    ? await countOne(env, `
        SELECT COUNT(*) AS total
        FROM blogspot_post_map
        WHERE kind='post' AND dirty=1 AND deleted_local=0
      `)
    : 0;

  const pages_dirty = sync_pages_enabled !== "0"
    ? await countOne(env, `
        SELECT COUNT(*) AS total
        FROM blogspot_post_map
        WHERE kind='page' AND dirty=1 AND deleted_local=0
      `)
    : 0;

  const widgets_dirty = sync_widgets_enabled !== "0"
    ? await countOne(env, `
        SELECT COUNT(*) AS total
        FROM cms_widgets
        WHERE provider='blogspot'
      `)
    : 0;

  const home_blocks = sync_widgets_enabled !== "0"
    ? await countOne(env, `
        SELECT COUNT(*) AS total
        FROM blogspot_widget_home
        WHERE status='active'
      `)
    : 0;

  return {
    direction: sync_direction || "bidirectional",
    sync_posts_enabled: sync_posts_enabled !== "0",
    sync_pages_enabled: sync_pages_enabled !== "0",
    sync_widgets_enabled: sync_widgets_enabled !== "0",
    posts_dirty,
    pages_dirty,
    widgets_dirty,
    home_blocks,
    cron_driver: cron_driver || "cron_trigger",
    note: "Cron summary generated. Remote Blogger write still requires OAuth user auth."
  };
}

export async function onRequestGet({ request, env }){
  const enabled = await getCfg(env, "enabled");
  const auto = await getCfg(env, "auto_sync_enabled");
  const intervalMin = Math.max(1, Number(await getCfg(env, "sync_interval_min") || "15"));
  const lastRun = Number(await getState(env, "last_run_at") || "0");
  const now = nowSec();

  if(enabled !== "1" || auto !== "1"){
    await addLog(env, {
      direction: "system",
      kind: "system",
      action: "cron",
      status: "skipped",
      message: "auto sync disabled",
      payload_json: {
        enabled,
        auto_sync_enabled: auto
      }
    });

    return json(200, "ok", {
      ran: false,
      status: "skipped",
      message: "auto sync disabled"
    });
  }

  if((now - lastRun) < intervalMin * 60){
    const next_in_sec = intervalMin * 60 - (now - lastRun);

    return json(200, "ok", {
      ran: false,
      status: "noop",
      message: "interval not reached",
      next_in_sec
    });
  }

  const cfg = await getBlogspotConfig(env);
  if(!cfg.enabled || !cfg.blog_id || !cfg.api_key){
    await setState(env, "last_status", "error");
    await setState(env, "last_message", "missing blogspot config");

    await addLog(env, {
      direction: "system",
      kind: "system",
      action: "cron",
      status: "error",
      message: "missing blogspot config",
      payload_json: {
        enabled: cfg.enabled,
        blog_id: !!cfg.blog_id,
        api_key: !!cfg.api_key
      }
    });

    return json(200, "ok", {
      ran: false,
      status: "error",
      message: "missing blogspot config"
    });
  }

  await setState(env, "last_run_at", now);
  await setState(env, "last_status", "running");
  await setState(env, "last_message", "cron sync started");

  const summary = await buildSummary(env);

  await setState(env, "last_status", "ok");
  await setState(env, "last_success_at", nowSec());
  await setState(env, "last_message", "cron sync summary generated");

  await addLog(env, {
    direction: summary.direction,
    kind: "system",
    action: "cron",
    status: "ok",
    message: "cron sync summary generated",
    payload_json: summary
  });

  return json(200, "ok", {
    ran: true,
    status: "ok",
    message: "cron sync summary generated",
    summary
  });
}

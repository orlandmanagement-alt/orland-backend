import { json, nowSec } from "../../../_lib.js";
import { requireBlogspotAccess, getBlogspotConfig } from "./_service.js";

async function getConfig(env, k){
  const row = await env.DB.prepare(
    "SELECT v FROM blogspot_sync_config WHERE k=? LIMIT 1"
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
    String(row.action || "run"),
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

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const cfg = await getBlogspotConfig(env);
  const enabled = await getConfig(env, "enabled");
  const sync_direction = await getConfig(env, "sync_direction");
  const sync_posts_enabled = await getConfig(env, "sync_posts_enabled");
  const sync_pages_enabled = await getConfig(env, "sync_pages_enabled");
  const sync_widgets_enabled = await getConfig(env, "sync_widgets_enabled");
  const cron_driver = await getConfig(env, "cron_driver");

  await setState(env, "last_run_at", nowSec());
  await setState(env, "last_status", "running");
  await setState(env, "last_message", "sync started");

  if(enabled !== "1"){
    await setState(env, "last_status", "skipped");
    await setState(env, "last_message", "sync disabled");
    await addLog(env, {
      direction: "system",
      kind: "system",
      action: "run",
      status: "skipped",
      message: "sync disabled"
    });
    return json(200, "ok", { ran: false, status: "skipped", message: "sync disabled" });
  }

  if(!cfg.enabled || !cfg.blog_id || !cfg.api_key){
    await setState(env, "last_status", "error");
    await setState(env, "last_message", "missing blogspot config");
    await addLog(env, {
      direction: "system",
      kind: "system",
      action: "run",
      status: "error",
      message: "missing blogspot config"
    });
    return json(200, "ok", { ran: false, status: "error", message: "missing blogspot config" });
  }

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

  const summary = {
    direction: sync_direction || "bidirectional",
    sync_posts_enabled: sync_posts_enabled !== "0",
    sync_pages_enabled: sync_pages_enabled !== "0",
    sync_widgets_enabled: sync_widgets_enabled !== "0",
    posts_dirty,
    pages_dirty,
    widgets_dirty,
    home_blocks,
    cron_driver: cron_driver || "cron_trigger",
    note: "Remote write to Blogger requires OAuth user auth. API key only supports read-only."
  };

  await setState(env, "last_status", "ok");
  await setState(env, "last_success_at", nowSec());
  await setState(env, "last_message", "sync summary generated");

  await addLog(env, {
    direction: summary.direction,
    kind: "system",
    action: "run",
    status: "ok",
    message: "sync summary generated",
    payload_json: summary
  });

  return json(200, "ok", {
    ran: true,
    status: "ok",
    summary
  });
}

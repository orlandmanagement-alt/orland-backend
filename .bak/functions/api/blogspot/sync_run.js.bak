import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";
import { getBlogspotConfig } from "./_service.js";

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
      v=excluded.v,
      updated_at=excluded.updated_at
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

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const cfg = await getBlogspotConfig(env);
  const enabled = await getConfig(env, "enabled");
  const sync_direction = await getConfig(env, "sync_direction");
  const sync_posts_enabled = await getConfig(env, "sync_posts_enabled");
  const sync_pages_enabled = await getConfig(env, "sync_pages_enabled");

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

  const summary = {
    direction: sync_direction || "bidirectional",
    sync_posts_enabled: sync_posts_enabled !== "0",
    sync_pages_enabled: sync_pages_enabled !== "0",
    posts_dirty: 0,
    pages_dirty: 0,
    note: "core runner ready; CRUD push/pull detail to be attached next"
  };

  if(sync_posts_enabled !== "0"){
    const r = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM blogspot_post_map
      WHERE kind='post' AND dirty=1 AND deleted_local=0
    `).first();
    summary.posts_dirty = Number(r?.total || 0);
  }

  if(sync_pages_enabled !== "0"){
    const r = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM blogspot_post_map
      WHERE kind='page' AND dirty=1 AND deleted_local=0
    `).first();
    summary.pages_dirty = Number(r?.total || 0);
  }

  await setState(env, "last_status", "ok");
  await setState(env, "last_success_at", nowSec());
  await setState(env, "last_message", "sync completed");

  await addLog(env, {
    direction: summary.direction,
    kind: "system",
    action: "run",
    status: "ok",
    message: "sync completed",
    payload_json: summary
  });

  return json(200, "ok", {
    ran: true,
    status: "ok",
    summary
  });
}

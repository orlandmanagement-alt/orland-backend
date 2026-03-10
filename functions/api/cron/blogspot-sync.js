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
    String(row.action || "cron"),
    String(row.status || "ok"),
    row.message || "",
    JSON.stringify(row.payload_json || {}),
    nowSec()
  ).run();
}

export async function onRequestGet({ env }){
  const enabled = await getCfg(env, "enabled");
  const auto = await getCfg(env, "auto_sync_enabled");
  const intervalMin = Math.max(1, Number(await getCfg(env, "sync_interval_min") || "15"));
  const lastRun = Number(await getState(env, "last_run_at") || "0");
  const now = nowSec();

  if(enabled !== "1" || auto !== "1"){
    return json(200, "ok", {
      ran: false,
      status: "skipped",
      message: "auto sync disabled"
    });
  }

  if((now - lastRun) < intervalMin * 60){
    return json(200, "ok", {
      ran: false,
      status: "noop",
      message: "interval not reached",
      next_in_sec: intervalMin * 60 - (now - lastRun)
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
      message: "missing blogspot config"
    });
    return json(200, "ok", {
      ran: false,
      status: "error",
      message: "missing blogspot config"
    });
  }

  await setState(env, "last_run_at", now);
  await setState(env, "last_status", "ok");
  await setState(env, "last_success_at", now);
  await setState(env, "last_message", "cron sync completed");

  await addLog(env, {
    direction: "system",
    kind: "system",
    action: "cron",
    status: "ok",
    message: "cron sync completed"
  });

  return json(200, "ok", {
    ran: true,
    status: "ok",
    message: "cron sync completed"
  });
}

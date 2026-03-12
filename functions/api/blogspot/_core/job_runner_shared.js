import { json, nowSec, readJson } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";

export async function requireJobRunnerAccess(env, request, allowStaff = true){
  return await requireBlogspotAccess(env, request, allowStaff);
}

export async function setRunnerConfig(env, k, v){
  await env.DB.prepare(`
    INSERT INTO blogspot_job_runner_config (k, v, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      updated_at = excluded.updated_at
  `).bind(String(k), String(v ?? ""), nowSec()).run();
}

export async function getRunnerConfigValue(env, k, fallback = ""){
  const row = await env.DB.prepare(`
    SELECT v FROM blogspot_job_runner_config
    WHERE k=?
    LIMIT 1
  `).bind(String(k)).first();
  return row ? String(row.v || "") : String(fallback ?? "");
}

export async function getRunnerConfig(env){
  const runner_enabled = await getRunnerConfigValue(env, "runner_enabled", "0");
  const runner_paused = await getRunnerConfigValue(env, "runner_paused", "0");
  const batch_limit = await getRunnerConfigValue(env, "batch_limit", "10");
  const stale_lock_sec = await getRunnerConfigValue(env, "stale_lock_sec", "300");
  const max_runtime_sec = await getRunnerConfigValue(env, "max_runtime_sec", "20");
  const cron_secret = await getRunnerConfigValue(env, "cron_secret", "");

  return {
    runner_enabled: runner_enabled === "1",
    runner_paused: runner_paused === "1",
    batch_limit: Math.max(1, Math.min(50, Number(batch_limit || 10))),
    stale_lock_sec: Math.max(30, Math.min(86400, Number(stale_lock_sec || 300))),
    max_runtime_sec: Math.max(5, Math.min(300, Number(max_runtime_sec || 20))),
    cron_secret
  };
}

export async function setWorkerState(env, workerId, patch = {}){
  const ts = nowSec();
  await env.DB.prepare(`
    INSERT INTO blogspot_job_worker_state (
      worker_id, status, last_heartbeat_at, last_started_at,
      last_finished_at, last_result_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(worker_id) DO UPDATE SET
      status = excluded.status,
      last_heartbeat_at = excluded.last_heartbeat_at,
      last_started_at = excluded.last_started_at,
      last_finished_at = excluded.last_finished_at,
      last_result_json = excluded.last_result_json,
      updated_at = excluded.updated_at
  `).bind(
    String(workerId || "worker"),
    String(patch.status || "idle"),
    Number(patch.last_heartbeat_at ?? ts),
    Number(patch.last_started_at ?? 0),
    Number(patch.last_finished_at ?? 0),
    JSON.stringify(patch.last_result_json ?? null),
    ts
  ).run();
}

export async function getWorkerStates(env, limit = 20){
  const r = await env.DB.prepare(`
    SELECT
      worker_id, status, last_heartbeat_at, last_started_at,
      last_finished_at, last_result_json, updated_at
    FROM blogspot_job_worker_state
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(Math.max(1, Math.min(100, Number(limit || 20)))).all();

  return (r.results || []).map(x => ({
    worker_id: String(x.worker_id || ""),
    status: String(x.status || ""),
    last_heartbeat_at: Number(x.last_heartbeat_at || 0),
    last_started_at: Number(x.last_started_at || 0),
    last_finished_at: Number(x.last_finished_at || 0),
    last_result_json: (() => {
      try{ return JSON.parse(String(x.last_result_json || "null")); }
      catch{ return null; }
    })(),
    updated_at: Number(x.updated_at || 0)
  }));
}

export async function unlockStaleJobs(env, staleLockSec = 300){
  const threshold = nowSec() - Math.max(30, Number(staleLockSec || 300));

  const r = await env.DB.prepare(`
    SELECT id
    FROM blogspot_job_queue
    WHERE status='running'
      AND locked_at IS NOT NULL
      AND locked_at > 0
      AND locked_at <= ?
  `).bind(threshold).all();

  const ids = (r.results || []).map(x => String(x.id || "")).filter(Boolean);
  let released = 0;

  for(const id of ids){
    const upd = await env.DB.prepare(`
      UPDATE blogspot_job_queue
      SET status='queued',
          locked_at=NULL,
          locked_by=NULL,
          updated_at=?
      WHERE id=?
        AND status='running'
    `).bind(nowSec(), id).run();

    released += Number(upd.meta?.changes || 0);
  }

  return { released, ids };
}

export async function queueCounters(env){
  const r = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued_total,
      SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) AS running_total,
      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS success_total,
      SUM(CASE WHEN status='dead_letter' THEN 1 ELSE 0 END) AS dead_letter_total
    FROM blogspot_job_queue
  `).first();

  const d = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM blogspot_job_dead_letter
  `).first();

  return {
    queued_total: Number(r?.queued_total || 0),
    running_total: Number(r?.running_total || 0),
    success_total: Number(r?.success_total || 0),
    dead_letter_total: Number(r?.dead_letter_total || 0),
    dead_letter_rows: Number(d?.total || 0)
  };
}

export function checkCronSecret(request, cfg){
  const expected = String(cfg?.cron_secret || "").trim();
  if(!expected) return true;

  const hdr = String(request.headers.get("x-cron-secret") || "").trim();
  const url = new URL(request.url);
  const qs = String(url.searchParams.get("cron_secret") || "").trim();

  return hdr === expected || qs === expected;
}

export async function invokeJobBatchRunner(env, workerId, limit){
  const mod = await import("./job_run_batch.js");
  const fakeReq = new Request("https://queue.local/api/blogspot/job_run_batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      limit: Number(limit || 10),
      worker_id: String(workerId || "cron_worker")
    })
  });

  const res = await mod.onRequestPost({
    request: fakeReq,
    env,
    __cron_runner_internal: true
  });

  const data = await res.json().catch(() => null);
  return {
    ok: res.ok && data?.status === "ok",
    data
  };
}

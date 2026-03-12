import { nowSec, json } from "../../../_lib.js";
import { requireBlogspotAccess, makeId } from "./_service.js";
import { syncIdempotencyStatus } from "./job_dedup_shared.js";
import { appendLedgerEvent } from "./audit_ledger_shared.js";

export async function requireJobQueueAccess(env, request, allowStaff = true){
  return await requireBlogspotAccess(env, request, allowStaff);
}

export function safeJsonParse(v, fallback = null){
  try{
    const x = JSON.parse(String(v || ""));
    return x ?? fallback;
  }catch{
    return fallback;
  }
}

export async function addJobLog(env, row){
  try{
    await env.DB.prepare(`
      INSERT INTO blogspot_sync_logs (
        id, site_id, direction, kind, local_id, remote_id, action, status, message, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId("bslog"),
      row.site_id || null,
      String(row.direction || "system"),
      String(row.kind || "system"),
      row.local_id || null,
      row.remote_id || null,
      String(row.action || "job"),
      String(row.status || "ok"),
      String(row.message || ""),
      JSON.stringify(row.payload_json || {}),
      nowSec()
    ).run();
  }catch{}
}

export function normalizeJobType(v){
  return String(v || "").trim().toLowerCase();
}

export function computeNextRunAfter(attemptCount){
  const n = Math.max(1, Number(attemptCount || 1));
  const backoff = Math.min(3600, Math.pow(2, Math.min(n, 10)) * 30);
  return nowSec() + backoff;
}

export async function enqueueJob(env, {
  job_type,
  payload = {},
  priority = 100,
  max_attempts = 3,
  run_after = 0,
  created_by = null
}){
  const id = crypto.randomUUID();
  const ts = nowSec();

  await env.DB.prepare(`
    INSERT INTO blogspot_job_queue (
      id, site_id, job_type, payload_json, status, priority,
      attempt_count, max_attempts, run_after,
      locked_at, locked_by, last_error, result_json,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'queued', ?, 0, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?)
  `).bind(
    id,
    payload?.site_id || null,
    normalizeJobType(job_type),
    JSON.stringify(payload || {}),
    Number(priority || 100),
    Math.max(1, Number(max_attempts || 3)),
    Math.max(0, Number(run_after || 0)),
    created_by,
    ts,
    ts
  ).run();

  return { id };
}

export async function lockNextJobs(env, workerId, limit = 10){
  const now = nowSec();

  const r = await env.DB.prepare(`
    SELECT id
    FROM blogspot_job_queue
    WHERE status='queued'
      AND run_after <= ?
      AND (locked_at IS NULL OR locked_at = 0)
    ORDER BY priority ASC, created_at ASC
    LIMIT ?
  `).bind(now, Math.max(1, Math.min(50, Number(limit || 10)))).all();

  const rows = r.results || [];
  const locked = [];

  for(const row of rows){
    const jobId = String(row.id || "");
    if(!jobId) continue;

    const upd = await env.DB.prepare(`
      UPDATE blogspot_job_queue
      SET status='running',
          locked_at=?,
          locked_by=?,
          updated_at=?
      WHERE id=?
        AND status='queued'
        AND (locked_at IS NULL OR locked_at = 0)
    `).bind(now, String(workerId || "worker"), now, jobId).run();

    if(Number(upd.meta?.changes || 0) > 0){
      locked.push(jobId);
    }
  }

  if(!locked.length) return [];

  const ph = locked.map(() => "?").join(",");
  const jobs = await env.DB.prepare(`
    SELECT
      id, site_id, job_type, payload_json, status, priority,
      attempt_count, max_attempts, run_after,
      locked_at, locked_by, last_error, result_json,
      created_by, created_at, updated_at
    FROM blogspot_job_queue
    WHERE id IN (${ph})
    ORDER BY priority ASC, created_at ASC
  `).bind(...locked).all();

  return (jobs.results || []).map(x => ({
    id: String(x.id || ""),
    site_id: x.site_id || null,
    job_type: String(x.job_type || ""),
    payload_json: safeJsonParse(x.payload_json, {}),
    status: String(x.status || ""),
    priority: Number(x.priority || 100),
    attempt_count: Number(x.attempt_count || 0),
    max_attempts: Number(x.max_attempts || 3),
    run_after: Number(x.run_after || 0),
    locked_at: Number(x.locked_at || 0),
    locked_by: String(x.locked_by || ""),
    last_error: String(x.last_error || ""),
    result_json: safeJsonParse(x.result_json, null),
    created_by: x.created_by || null,
    created_at: Number(x.created_at || 0),
    updated_at: Number(x.updated_at || 0)
  }));
}

async function markScheduleCompletedByQueuedJob(env, jobId){
  try{
    await env.DB.prepare(`
      UPDATE blogspot_schedule_jobs
      SET status='completed',
          updated_at=?
      WHERE queued_job_id=?
        AND status='queued'
    `).bind(nowSec(), String(jobId || "")).run();
  }catch{}
}

export async function markJobSuccess(env, jobId, result = {}){
  const ts = nowSec();

  await env.DB.prepare(`
    UPDATE blogspot_job_queue
    SET status='success',
        result_json=?,
        last_error=NULL,
        locked_at=NULL,
        locked_by=NULL,
        updated_at=?
    WHERE id=?
  `).bind(JSON.stringify(result || {}), ts, String(jobId || "")).run();

  await markScheduleCompletedByQueuedJob(env, jobId);
  await syncIdempotencyStatus(env, jobId, "success");

  try{
    await appendLedgerEvent(env, {
      event_type: "job_success",
      item_kind: null,
      item_id: String(jobId || ""),
      actor_user_id: null,
      payload: result || {}
    });
  }catch{}
}

export async function markJobRetry(env, job, errorMessage, result = null){
  const nextAttempt = Number(job.attempt_count || 0) + 1;
  const ts = nowSec();

  if(nextAttempt >= Number(job.max_attempts || 3)){
    await moveToDeadLetter(env, job, errorMessage, result);

    await env.DB.prepare(`
      UPDATE blogspot_job_queue
      SET status='dead_letter',
          attempt_count=?,
          last_error=?,
          result_json=?,
          locked_at=NULL,
          locked_by=NULL,
          updated_at=?
      WHERE id=?
    `).bind(
      nextAttempt,
      String(errorMessage || "job_failed"),
      JSON.stringify(result || null),
      ts,
      String(job.id || "")
    ).run();

    await syncIdempotencyStatus(env, job.id, "dead_letter");

    try{
      await appendLedgerEvent(env, {
        event_type: "job_dead_letter",
        item_kind: null,
        item_id: String(job.id || ""),
        actor_user_id: null,
        payload: {
          error: String(errorMessage || "job_failed"),
          dead_letter: true
        }
      });
    }catch{}

    return { dead_letter: true };
  }

  await env.DB.prepare(`
    UPDATE blogspot_job_queue
    SET status='queued',
        attempt_count=?,
        run_after=?,
        last_error=?,
        result_json=?,
        locked_at=NULL,
        locked_by=NULL,
        updated_at=?
    WHERE id=?
  `).bind(
    nextAttempt,
    computeNextRunAfter(nextAttempt),
    String(errorMessage || "job_failed"),
    JSON.stringify(result || null),
    ts,
    String(job.id || "")
  ).run();

  await syncIdempotencyStatus(env, job.id, "queued");

  try{
    await appendLedgerEvent(env, {
      event_type: "job_retry",
      item_kind: null,
      item_id: String(job.id || ""),
      actor_user_id: null,
      payload: {
        error: String(errorMessage || "job_failed"),
        dead_letter: false
      }
    });
  }catch{}

  return { dead_letter: false };
}

export async function moveToDeadLetter(env, job, errorMessage, result = null, movedBy = null, note = ""){
  await env.DB.prepare(`
    INSERT INTO blogspot_job_dead_letter (
      id, site_id, source_job_id, job_type, payload_json,
      attempt_count, max_attempts, last_error, result_json,
      moved_at, moved_by, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    job.site_id || job.payload_json?.site_id || null,
    String(job.id || ""),
    String(job.job_type || ""),
    JSON.stringify(job.payload_json || {}),
    Number(job.attempt_count || 0) + 1,
    Number(job.max_attempts || 3),
    String(errorMessage || "job_failed"),
    JSON.stringify(result || null),
    nowSec(),
    movedBy,
    String(note || "")
  ).run();
}

export async function executeJob(env, actorUserId, job){
  const type = normalizeJobType(job.job_type);
  const payload = job.payload_json || {};

  if(type === "publish_post"){
    return await executePublishPost(env, payload);
  }
  if(type === "publish_page"){
    return await executePublishPage(env, payload);
  }
  if(type === "refresh_remote_post"){
    return await executeRefreshRemotePost(env, payload);
  }
  if(type === "refresh_remote_page"){
    return await executeRefreshRemotePage(env, payload);
  }
  if(type === "sync_run"){
    return await executeSyncRun(env);
  }
  if(type === "resolve_conflict"){
    return await executeResolveConflict(env, actorUserId, payload);
  }
  if(type === "delete_remote_post"){
    return await executeDeleteRemotePost(env, payload);
  }
  if(type === "delete_remote_page"){
    return await executeDeleteRemotePage(env, payload);
  }

  return {
    ok: false,
    error: "unsupported_job_type",
    detail: { job_type: type }
  };
}

async function executePublishPost(env, payload){
  const id = String(payload.id || "").trim();
  if(!id) return { ok:false, error:"id_required" };

  const mod = await import("./publish_post.js");
  const fakeReq = new Request("https://queue.local/api/blogspot/publish_post", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, site_id: payload.site_id || null })
  });

  const res = await mod.onRequestPost({ request: fakeReq, env });
  const data = await res.json().catch(() => null);

  return res.ok && data?.status === "ok"
    ? { ok:true, result:data?.data || {} }
    : { ok:false, error:data?.data?.error || data?.status || "publish_post_failed", detail:data };
}

async function executePublishPage(env, payload){
  const id = String(payload.id || "").trim();
  if(!id) return { ok:false, error:"id_required" };

  const mod = await import("./publish_page.js");
  const fakeReq = new Request("https://queue.local/api/blogspot/publish_page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, site_id: payload.site_id || null })
  });

  const res = await mod.onRequestPost({ request: fakeReq, env });
  const data = await res.json().catch(() => null);

  return res.ok && data?.status === "ok"
    ? { ok:true, result:data?.data || {} }
    : { ok:false, error:data?.data?.error || data?.status || "publish_page_failed", detail:data };
}

async function executeRefreshRemotePost(env, payload){
  const id = String(payload.id || "").trim();
  if(!id) return { ok:false, error:"id_required" };

  const mod = await import("./refresh_remote_post.js");
  const fakeReq = new Request("https://queue.local/api/blogspot/refresh_remote_post", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, site_id: payload.site_id || null })
  });

  const res = await mod.onRequestPost({ request: fakeReq, env });
  const data = await res.json().catch(() => null);

  return res.ok && data?.status === "ok"
    ? { ok:true, result:data?.data || {} }
    : { ok:false, error:data?.data?.error || data?.status || "refresh_remote_post_failed", detail:data };
}

async function executeRefreshRemotePage(env, payload){
  const id = String(payload.id || "").trim();
  if(!id) return { ok:false, error:"id_required" };

  const mod = await import("./refresh_remote_page.js");
  const fakeReq = new Request("https://queue.local/api/blogspot/refresh_remote_page", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, site_id: payload.site_id || null })
  });

  const res = await mod.onRequestPost({ request: fakeReq, env });
  const data = await res.json().catch(() => null);

  return res.ok && data?.status === "ok"
    ? { ok:true, result:data?.data || {} }
    : { ok:false, error:data?.data?.error || data?.status || "refresh_remote_page_failed", detail:data };
}

async function executeSyncRun(env){
  const mod = await import("./sync_run.js");
  const fakeReq = new Request("https://queue.local/api/blogspot/sync_run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });

  const res = await mod.onRequestPost({ request: fakeReq, env });
  const data = await res.json().catch(() => null);

  return res.ok && data?.status === "ok"
    ? { ok:true, result:data?.data || {} }
    : { ok:false, error:data?.data?.message || data?.status || "sync_run_failed", detail:data };
}

async function executeResolveConflict(env, actorUserId, payload){
  const item_kind = String(payload.item_kind || "").trim();
  const item_id = String(payload.item_id || "").trim();
  const resolver = String(payload.resolver || "").trim();
  const note = String(payload.note || "").trim();

  if(!item_kind || !item_id || !resolver){
    return { ok:false, error:"item_kind_item_id_resolver_required" };
  }

  const mod = await import("./conflict_resolve.js");
  const fakeReq = new Request("https://queue.local/api/blogspot/conflict_resolve", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cookie": ""
    },
    body: JSON.stringify({ item_kind, item_id, resolver, note, site_id: payload.site_id || null })
  });

  const res = await mod.onRequestPost({
    request: fakeReq,
    env,
    __queue_actor_user_id: actorUserId || null
  });

  const data = await res.json().catch(() => null);
  return res.ok && data?.status === "ok"
    ? { ok:true, result:data?.data || {} }
    : { ok:false, error:data?.data?.error || data?.status || "resolve_conflict_failed", detail:data };
}

async function executeDeleteRemotePost(env, payload){
  const id = String(payload.id || "").trim();
  if(!id) return { ok:false, error:"id_required" };

  try{
    const mod = await import("./delete_remote_post.js");
    const fakeReq = new Request("https://queue.local/api/blogspot/delete_remote_post", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, site_id: payload.site_id || null })
    });
    const res = await mod.onRequestPost({ request: fakeReq, env });
    const data = await res.json().catch(() => null);

    return res.ok && data?.status === "ok"
      ? { ok:true, result:data?.data || {} }
      : { ok:false, error:data?.data?.error || data?.status || "delete_remote_post_failed", detail:data };
  }catch(e){
    return { ok:false, error:"delete_remote_post_endpoint_missing", detail:String(e?.message || e) };
  }
}

async function executeDeleteRemotePage(env, payload){
  const id = String(payload.id || "").trim();
  if(!id) return { ok:false, error:"id_required" };

  try{
    const mod = await import("./delete_remote_page.js");
    const fakeReq = new Request("https://queue.local/api/blogspot/delete_remote_page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, site_id: payload.site_id || null })
    });
    const res = await mod.onRequestPost({ request: fakeReq, env });
    const data = await res.json().catch(() => null);

    return res.ok && data?.status === "ok"
      ? { ok:true, result:data?.data || {} }
      : { ok:false, error:data?.data?.error || data?.status || "delete_remote_page_failed", detail:data };
  }catch(e){
    return { ok:false, error:"delete_remote_page_endpoint_missing", detail:String(e?.message || e) };
  }
}

export function okResponse(data){
  return json(200, "ok", data);
}
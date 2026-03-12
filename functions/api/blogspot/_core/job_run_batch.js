import { json, readJson } from "../../../_lib.js";
import {
  requireJobQueueAccess,
  lockNextJobs,
  executeJob,
  markJobSuccess,
  markJobRetry,
  addJobLog
} from "./job_queue_shared.js";
import {
  checkJobPolicy,
  incrementRateWindow,
  resourceKeyFromJob
} from "./job_policy_shared.js";
import {
  breakerScopeForJobType,
  checkBreaker,
  recordUpstreamFailure,
  recordUpstreamSuccess,
  bumpQuota
} from "./job_breaker_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireJobQueueAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const limit = Math.max(1, Math.min(50, Number(body.limit || 10)));
  const worker_id = String(body.worker_id || `manual_${Date.now()}`).trim();

  const jobs = await lockNextJobs(env, worker_id, limit);
  if(!jobs.length){
    return json(200, "ok", {
      worker_id,
      locked: 0,
      success: 0,
      retry: 0,
      dead_letter: 0,
      items: []
    });
  }

  const results = [];
  let success = 0;
  let retry = 0;
  let dead_letter = 0;

  for(const job of jobs){
    const policy = await checkJobPolicy(env, job);
    if(!policy.ok){
      const retryRes = await markJobRetry(env, job, "policy_blocked:" + policy.reason, {
        policy
      });

      if(retryRes.dead_letter) dead_letter++;
      else retry++;

      await addJobLog(env, {
        direction: "system",
        kind: "system",
        action: retryRes.dead_letter ? "job_dead_letter" : "job_retry",
        status: retryRes.dead_letter ? "error" : "retry",
        message: "policy_blocked:" + policy.reason,
        payload_json: {
          job_id: job.id,
          job_type: job.job_type,
          resource_key: resourceKeyFromJob(job),
          dead_letter: !!retryRes.dead_letter
        }
      });

      results.push({
        id: job.id,
        job_type: job.job_type,
        ok: false,
        dead_letter: !!retryRes.dead_letter,
        error: "policy_blocked:" + policy.reason
      });
      continue;
    }

    await incrementRateWindow(env, "runner", "global");

    const breakerScope = breakerScopeForJobType(job.job_type);
    const breaker = await checkBreaker(env, breakerScope);
    if(!breaker.ok){
      const retryRes = await markJobRetry(env, job, "breaker_open:" + breakerScope, {
        breaker
      });

      if(retryRes.dead_letter) dead_letter++;
      else retry++;

      await addJobLog(env, {
        direction: "system",
        kind: "system",
        action: retryRes.dead_letter ? "job_dead_letter" : "job_retry",
        status: retryRes.dead_letter ? "error" : "retry",
        message: "breaker_open:" + breakerScope,
        payload_json: {
          job_id: job.id,
          job_type: job.job_type,
          resource_key: resourceKeyFromJob(job),
          dead_letter: !!retryRes.dead_letter
        }
      });

      results.push({
        id: job.id,
        job_type: job.job_type,
        ok: false,
        dead_letter: !!retryRes.dead_letter,
        error: "breaker_open:" + breakerScope
      });
      continue;
    }

    const execRes = await executeJob(env, a.uid || null, job);
    await bumpQuota(env, breakerScope);

    if(execRes.ok){
      await recordUpstreamSuccess(env, breakerScope);
      await markJobSuccess(env, job.id, execRes.result || {});

      await addJobLog(env, {
        direction: "system",
        kind: "system",
        action: "job_success",
        status: "ok",
        message: "job executed successfully",
        payload_json: {
          job_id: job.id,
          job_type: job.job_type,
          resource_key: resourceKeyFromJob(job)
        }
      });

      success++;
      results.push({
        id: job.id,
        job_type: job.job_type,
        ok: true,
        result: execRes.result || {}
      });
      continue;
    }

    await recordUpstreamFailure(env, breakerScope, execRes.error || "job_failed");

    const retryRes = await markJobRetry(env, job, execRes.error || "job_failed", execRes.detail || null);
    if(retryRes.dead_letter) dead_letter++;
    else retry++;

    await addJobLog(env, {
      direction: "system",
      kind: "system",
      action: retryRes.dead_letter ? "job_dead_letter" : "job_retry",
      status: retryRes.dead_letter ? "error" : "retry",
      message: execRes.error || "job_failed",
      payload_json: {
        job_id: job.id,
        job_type: job.job_type,
        resource_key: resourceKeyFromJob(job),
        dead_letter: !!retryRes.dead_letter
      }
    });

    results.push({
      id: job.id,
      job_type: job.job_type,
      ok: false,
      dead_letter: !!retryRes.dead_letter,
      error: execRes.error || "job_failed"
    });
  }

  return json(200, "ok", {
    worker_id,
    locked: jobs.length,
    success,
    retry,
    dead_letter,
    items: results
  });
}
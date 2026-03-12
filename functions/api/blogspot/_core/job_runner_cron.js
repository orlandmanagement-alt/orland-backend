import { json, nowSec } from "../../../_lib.js";
import {
  getRunnerConfig,
  checkCronSecret,
  setWorkerState,
  unlockStaleJobs,
  invokeJobBatchRunner
} from "./job_runner_shared.js";

export async function onRequestPost({ request, env }){
  const cfg = await getRunnerConfig(env);

  if(!checkCronSecret(request, cfg)){
    return json(403, "forbidden", { error:"invalid_cron_secret" });
  }

  if(!cfg.runner_enabled){
    return json(200, "ok", {
      ran: false,
      status: "disabled"
    });
  }

  if(cfg.runner_paused){
    return json(200, "ok", {
      ran: false,
      status: "paused"
    });
  }

  const workerId = `cron_${nowSec()}`;
  const startedAt = nowSec();

  await setWorkerState(env, workerId, {
    status: "running",
    last_heartbeat_at: startedAt,
    last_started_at: startedAt,
    last_finished_at: 0,
    last_result_json: { status:"starting" }
  });

  const stale = await unlockStaleJobs(env, cfg.stale_lock_sec);

  await setWorkerState(env, workerId, {
    status: "running",
    last_heartbeat_at: nowSec(),
    last_started_at: startedAt,
    last_finished_at: 0,
    last_result_json: {
      status: "stale_unlock_done",
      stale_released: stale.released
    }
  });

  const runRes = await invokeJobBatchRunner(env, workerId, cfg.batch_limit);
  const finishedAt = nowSec();

  await setWorkerState(env, workerId, {
    status: runRes.ok ? "success" : "error",
    last_heartbeat_at: finishedAt,
    last_started_at: startedAt,
    last_finished_at: finishedAt,
    last_result_json: runRes.data || null
  });

  return json(200, "ok", {
    ran: true,
    worker_id: workerId,
    stale_released: stale.released,
    batch: runRes.data || null
  });
}

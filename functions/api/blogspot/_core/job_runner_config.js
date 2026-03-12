import { json, readJson } from "../../../_lib.js";
import {
  requireJobRunnerAccess,
  setRunnerConfig,
  getRunnerConfig
} from "./job_runner_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireJobRunnerAccess(env, request, true);
  if(!a.ok) return a.res;

  return json(200, "ok", await getRunnerConfig(env));
}

export async function onRequestPost({ request, env }){
  const a = await requireJobRunnerAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};

  await setRunnerConfig(env, "runner_enabled", body.runner_enabled ? "1" : "0");
  await setRunnerConfig(env, "runner_paused", body.runner_paused ? "1" : "0");
  await setRunnerConfig(env, "batch_limit", Math.max(1, Math.min(50, Number(body.batch_limit || 10))));
  await setRunnerConfig(env, "stale_lock_sec", Math.max(30, Math.min(86400, Number(body.stale_lock_sec || 300))));
  await setRunnerConfig(env, "max_runtime_sec", Math.max(5, Math.min(300, Number(body.max_runtime_sec || 20))));
  if(body.cron_secret != null){
    await setRunnerConfig(env, "cron_secret", String(body.cron_secret || ""));
  }

  return json(200, "ok", {
    saved: true,
    config: await getRunnerConfig(env)
  });
}

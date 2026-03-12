import { json } from "../../../_lib.js";
import {
  requireJobRunnerAccess,
  getRunnerConfig,
  getWorkerStates,
  queueCounters
} from "./job_runner_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireJobRunnerAccess(env, request, true);
  if(!a.ok) return a.res;

  const [config, workers, counters] = await Promise.all([
    getRunnerConfig(env),
    getWorkerStates(env, 20),
    queueCounters(env)
  ]);

  return json(200, "ok", {
    config,
    workers,
    counters
  });
}

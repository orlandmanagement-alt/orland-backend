import { json } from "../../../_lib.js";
import {
  requireJobRunnerAccess,
  getRunnerConfig,
  unlockStaleJobs
} from "./job_runner_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireJobRunnerAccess(env, request, false);
  if(!a.ok) return a.res;

  const cfg = await getRunnerConfig(env);
  const r = await unlockStaleJobs(env, cfg.stale_lock_sec);

  return json(200, "ok", {
    unlocked: true,
    released: r.released,
    ids: r.ids
  });
}

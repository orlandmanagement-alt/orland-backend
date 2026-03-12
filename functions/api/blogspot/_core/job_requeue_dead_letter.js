import { json, readJson } from "../../../_lib.js";
import { requireJobQueueAccess, enqueueJob, addJobLog, safeJsonParse } from "./job_queue_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireJobQueueAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const dead_letter_id = String(body.dead_letter_id || "").trim();

  if(!dead_letter_id){
    return json(400, "invalid_input", { error:"dead_letter_id_required" });
  }

  const row = await env.DB.prepare(`
    SELECT
      id, source_job_id, job_type, payload_json,
      attempt_count, max_attempts, last_error, result_json,
      moved_at, moved_by, note
    FROM blogspot_job_dead_letter
    WHERE id=?
    LIMIT 1
  `).bind(dead_letter_id).first();

  if(!row){
    return json(404, "not_found", { error:"dead_letter_not_found" });
  }

  const payload = safeJsonParse(row.payload_json, {});
  const enq = await enqueueJob(env, {
    job_type: String(row.job_type || ""),
    payload,
    priority: 100,
    max_attempts: Math.max(1, Number(row.max_attempts || 3)),
    run_after: 0,
    created_by: a.uid || null
  });

  await addJobLog(env, {
    direction: "system",
    kind: "system",
    action: "job_requeue_dead_letter",
    status: "ok",
    message: "dead letter requeued",
    payload_json: {
      dead_letter_id,
      new_job_id: enq.id,
      job_type: String(row.job_type || "")
    }
  });

  return json(200, "ok", {
    requeued: true,
    dead_letter_id,
    new_job_id: enq.id
  });
}

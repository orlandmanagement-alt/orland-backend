import { readJson, json } from "../../../_lib.js";
import {
  requireJobQueueAccess,
  enqueueJob,
  addJobLog,
  normalizeJobType
} from "./job_queue_shared.js";
import {
  findActiveDuplicate,
  registerIdempotency
} from "./job_dedup_shared.js";
import { resolveActiveSite } from "./site_shared.js";

const ALLOWED_JOB_TYPES = new Set([
  "publish_post",
  "publish_page",
  "refresh_remote_post",
  "refresh_remote_page",
  "sync_run",
  "resolve_conflict",
  "delete_remote_post",
  "delete_remote_page"
]);

export async function onRequestPost({ request, env }){
  const a = await requireJobQueueAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const job_type = normalizeJobType(body.job_type || "");
  const payload = body.payload_json && typeof body.payload_json === "object" ? body.payload_json : {};
  const priority = Number(body.priority || 100);
  const max_attempts = Number(body.max_attempts || 3);
  const run_after = Number(body.run_after || 0);

  if(!job_type){
    return json(400, "invalid_input", { error:"job_type_required" });
  }

  if(!ALLOWED_JOB_TYPES.has(job_type)){
    return json(400, "invalid_input", { error:"unsupported_job_type" });
  }

  const activeSite = await resolveActiveSite(env, String(body.site_id || payload.site_id || "").trim());
  const enrichedPayload = {
    ...(payload || {}),
    site_id: activeSite?.id || payload?.site_id || null
  };

  const dup = await findActiveDuplicate(env, job_type, enrichedPayload);
  if(dup){
    return json(200, "ok", {
      enqueued: false,
      duplicate: true,
      id: dup.job_id,
      job_type,
      idempotency_key: dup.idempotency_key,
      active_status: dup.status
    });
  }

  const r = await enqueueJob(env, {
    job_type,
    payload: enrichedPayload,
    priority,
    max_attempts,
    run_after,
    created_by: a.uid || null
  });

  try{
    await env.DB.prepare(`
      UPDATE blogspot_job_queue
      SET site_id=?
      WHERE id=?
    `).bind(activeSite?.id || null, r.id).run();
  }catch{}

  const idem = await registerIdempotency(env, job_type, enrichedPayload, r.id, "queued");

  await addJobLog(env, {
    direction: "system",
    kind: "system",
    action: "job_enqueue",
    status: "ok",
    message: "job enqueued",
    payload_json: {
      job_id: r.id,
      job_type,
      site_id: activeSite?.id || null,
      idempotency_key: idem.key
    }
  });

  return json(200, "ok", {
    enqueued: true,
    id: r.id,
    job_type,
    site_id: activeSite?.id || null,
    idempotency_key: idem.key
  });
}
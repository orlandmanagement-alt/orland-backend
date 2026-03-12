import { json } from "../../../_lib.js";
import { requireJobQueueAccess, safeJsonParse } from "./job_queue_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireJobQueueAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const job_type = String(url.searchParams.get("job_type") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(300, Number(url.searchParams.get("limit") || "100")));

  let sql = `
    SELECT
      id, source_job_id, job_type, payload_json,
      attempt_count, max_attempts, last_error, result_json,
      moved_at, moved_by, note
    FROM blogspot_job_dead_letter
    WHERE 1=1
  `;
  const binds = [];

  if(job_type){
    sql += ` AND lower(job_type)=?`;
    binds.push(job_type);
  }

  sql += ` ORDER BY moved_at DESC LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      id: String(x.id || ""),
      source_job_id: String(x.source_job_id || ""),
      job_type: String(x.job_type || ""),
      payload_json: safeJsonParse(x.payload_json, {}),
      attempt_count: Number(x.attempt_count || 0),
      max_attempts: Number(x.max_attempts || 0),
      last_error: String(x.last_error || ""),
      result_json: safeJsonParse(x.result_json, null),
      moved_at: Number(x.moved_at || 0),
      moved_by: x.moved_by || null,
      note: String(x.note || "")
    })),
    total: (r.results || []).length
  });
}

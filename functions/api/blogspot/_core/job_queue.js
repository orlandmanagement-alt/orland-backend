import { json } from "../../../_lib.js";
import { requireJobQueueAccess, safeJsonParse } from "./job_queue_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireJobQueueAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const job_type = String(url.searchParams.get("job_type") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(300, Number(url.searchParams.get("limit") || "100")));

  let sql = `
    SELECT
      id, job_type, payload_json, status, priority, attempt_count, max_attempts,
      run_after, locked_at, locked_by, last_error, result_json,
      created_by, created_at, updated_at
    FROM blogspot_job_queue
    WHERE 1=1
  `;
  const binds = [];

  if(status){
    sql += ` AND lower(status)=?`;
    binds.push(status);
  }
  if(job_type){
    sql += ` AND lower(job_type)=?`;
    binds.push(job_type);
  }

  sql += ` ORDER BY
    CASE
      WHEN status='running' THEN 1
      WHEN status='queued' THEN 2
      WHEN status='dead_letter' THEN 3
      WHEN status='failed' THEN 4
      WHEN status='success' THEN 5
      ELSE 99
    END ASC,
    priority ASC,
    created_at DESC
    LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      id: String(x.id || ""),
      job_type: String(x.job_type || ""),
      payload_json: safeJsonParse(x.payload_json, {}),
      status: String(x.status || ""),
      priority: Number(x.priority || 100),
      attempt_count: Number(x.attempt_count || 0),
      max_attempts: Number(x.max_attempts || 0),
      run_after: Number(x.run_after || 0),
      locked_at: Number(x.locked_at || 0),
      locked_by: String(x.locked_by || ""),
      last_error: String(x.last_error || ""),
      result_json: safeJsonParse(x.result_json, null),
      created_by: x.created_by || null,
      created_at: Number(x.created_at || 0),
      updated_at: Number(x.updated_at || 0)
    })),
    total: (r.results || []).length
  });
}

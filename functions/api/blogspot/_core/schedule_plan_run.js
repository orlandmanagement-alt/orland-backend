import { json, nowSec } from "../../../_lib.js";
import { requireScheduleAccess, enqueueFromSchedule } from "./schedule_shared.js";
import { appendLedgerEvent } from "./audit_ledger_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireScheduleAccess(env, request, false);
  if(!a.ok) return a.res;

  const now = nowSec();

  const r = await env.DB.prepare(`
    SELECT
      id, site_id, item_kind, item_id, job_type, planned_at, timezone,
      status, payload_json, note, queued_job_id, last_error
    FROM blogspot_schedule_jobs
    WHERE status='scheduled'
      AND planned_at <= ?
    ORDER BY planned_at ASC
    LIMIT 25
  `).bind(now).all();

  const rows = r.results || [];
  const items = [];
  let queued = 0;
  let failed = 0;

  for(const row of rows){
    const res = await enqueueFromSchedule(env, row, a.uid || null);

    if(res.ok){
      await env.DB.prepare(`
        UPDATE blogspot_schedule_jobs
        SET status='queued',
            queued_job_id=?,
            last_error=NULL,
            updated_at=?
        WHERE id=?
      `).bind(
        String(res.job_id || ""),
        nowSec(),
        String(row.id || "")
      ).run();

      try{
        await appendLedgerEvent(env, {
          event_type: "schedule_queued",
          site_id: row.site_id || null,
          item_kind: String(row.item_kind || ""),
          item_id: String(row.item_id || ""),
          actor_user_id: a.uid || null,
          payload: {
            schedule_id: String(row.id || ""),
            queued_job_id: String(res.job_id || "")
          }
        });
      }catch{}

      queued++;
      items.push({
        id: String(row.id || ""),
        ok: true,
        queued_job_id: String(res.job_id || ""),
        duplicate: !!res.duplicate
      });
      continue;
    }

    await env.DB.prepare(`
      UPDATE blogspot_schedule_jobs
      SET status='failed',
          last_error=?,
          updated_at=?
      WHERE id=?
    `).bind(
      String(res.error || "enqueue_failed"),
      nowSec(),
      String(row.id || "")
    ).run();

    try{
      await appendLedgerEvent(env, {
        event_type: "schedule_failed",
        site_id: row.site_id || null,
        item_kind: String(row.item_kind || ""),
        item_id: String(row.item_id || ""),
        actor_user_id: a.uid || null,
        payload: {
          schedule_id: String(row.id || ""),
          error: String(res.error || "enqueue_failed")
        }
      });
    }catch{}

    failed++;
    items.push({
      id: String(row.id || ""),
      ok: false,
      error: String(res.error || "enqueue_failed"),
      detail: res.data || null
    });
  }

  return json(200, "ok", {
    scanned: rows.length,
    queued,
    failed,
    items
  });
}
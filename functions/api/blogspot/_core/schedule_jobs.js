import { json, readJson, nowSec } from "../../../_lib.js";
import {
  requireScheduleAccess,
  cleanItemKind,
  cleanJobType,
  safeJsonParse,
  loadLocalScheduledItem,
  createScheduleJob,
  updateScheduleJob
} from "./schedule_shared.js";
import { appendLedgerEvent } from "./audit_ledger_shared.js";
import { resolveActiveSite } from "./site_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireScheduleAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const site_id = String(url.searchParams.get("site_id") || "").trim();
  const item_kind = cleanItemKind(url.searchParams.get("item_kind") || "");
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(300, Number(url.searchParams.get("limit") || "100")));

  let sql = `
    SELECT
      s.id, s.site_id, s.item_kind, s.item_id, s.job_type, s.planned_at, s.timezone,
      s.status, s.payload_json, s.note, s.queued_job_id, s.last_error,
      s.created_by, s.created_at, s.updated_at
    FROM blogspot_schedule_jobs s
    WHERE 1=1
  `;
  const binds = [];

  if(site_id){
    sql += ` AND s.site_id=?`;
    binds.push(site_id);
  }
  if(item_kind){
    sql += ` AND s.item_kind=?`;
    binds.push(item_kind);
  }
  if(status){
    sql += ` AND lower(s.status)=?`;
    binds.push(status);
  }
  if(q){
    sql += ` AND (
      lower(coalesce(s.item_id, '')) LIKE ?
      OR lower(coalesce(s.note, '')) LIKE ?
    )`;
    binds.push(`%${q}%`, `%${q}%`);
  }

  sql += ` ORDER BY s.planned_at ASC, s.created_at DESC LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      id: String(x.id || ""),
      site_id: x.site_id || null,
      item_kind: String(x.item_kind || ""),
      item_id: String(x.item_id || ""),
      job_type: String(x.job_type || ""),
      planned_at: Number(x.planned_at || 0),
      timezone: String(x.timezone || "Asia/Jakarta"),
      status: String(x.status || ""),
      payload_json: safeJsonParse(x.payload_json, {}),
      note: String(x.note || ""),
      queued_job_id: String(x.queued_job_id || ""),
      last_error: String(x.last_error || ""),
      created_by: x.created_by || null,
      created_at: Number(x.created_at || 0),
      updated_at: Number(x.updated_at || 0)
    })),
    total: (r.results || []).length
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireScheduleAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const action = String(body.action || "create").trim().toLowerCase();
  const id = String(body.id || "").trim();

  if(!["create", "update", "cancel", "delete"].includes(action)){
    return json(400, "invalid_input", { error:"invalid_action" });
  }

  if(action === "delete"){
    if(!id) return json(400, "invalid_input", { error:"id_required" });

    await env.DB.prepare(`
      DELETE FROM blogspot_schedule_jobs
      WHERE id=?
    `).bind(id).run();

    try{
      await appendLedgerEvent(env, {
        event_type: "schedule_delete",
        item_kind: null,
        item_id: id,
        actor_user_id: a.uid || null,
        payload: { schedule_id: id }
      });
    }catch{}

    return json(200, "ok", {
      deleted: true,
      id
    });
  }

  if(action === "cancel"){
    if(!id) return json(400, "invalid_input", { error:"id_required" });

    const row = await env.DB.prepare(`
      SELECT id, status, planned_at, timezone, payload_json, note, queued_job_id, last_error
      FROM blogspot_schedule_jobs
      WHERE id=?
      LIMIT 1
    `).bind(id).first();

    if(!row) return json(404, "not_found", { error:"schedule_not_found" });

    await updateScheduleJob(env, id, {
      planned_at: Number(row.planned_at || 0),
      timezone: String(row.timezone || "Asia/Jakarta"),
      status: "cancelled",
      payload_json: safeJsonParse(row.payload_json, {}),
      note: String(row.note || ""),
      queued_job_id: row.queued_job_id || null,
      last_error: row.last_error || null
    });

    try{
      await appendLedgerEvent(env, {
        event_type: "schedule_cancel",
        item_kind: null,
        item_id: id,
        actor_user_id: a.uid || null,
        payload: { schedule_id: id }
      });
    }catch{}

    return json(200, "ok", {
      cancelled: true,
      id
    });
  }

  const item_kind = cleanItemKind(body.item_kind || "");
  const item_id = String(body.item_id || "").trim();
  const job_type = cleanJobType(body.job_type || "", item_kind);
  const planned_at = Number(body.planned_at || 0);
  const timezone = String(body.timezone || "Asia/Jakarta").trim() || "Asia/Jakarta";
  const note = String(body.note || "").trim();

  if(!item_kind || !item_id || !job_type || !planned_at){
    return json(400, "invalid_input", { error:"item_kind_item_id_job_type_planned_at_required" });
  }

  const item = await loadLocalScheduledItem(env, item_kind, item_id);
  if(!item){
    return json(404, "not_found", { error:"local_item_not_found" });
  }

  const activeSite = await resolveActiveSite(env, String(body.site_id || "").trim());

  const payload_json = {
    id: item_id,
    item_kind,
    scheduled: true,
    planned_at,
    timezone,
    site_id: activeSite?.id || null
  };

  if(action === "create"){
    const created = await createScheduleJob(env, {
      site_id: activeSite?.id || null,
      item_kind,
      item_id,
      job_type,
      planned_at,
      timezone,
      payload_json,
      note,
      created_by: a.uid || null
    });

    try{
      await appendLedgerEvent(env, {
        event_type: "schedule_create",
        site_id: activeSite?.id || null,
        item_kind,
        item_id,
        actor_user_id: a.uid || null,
        payload: {
          schedule_id: created.id,
          planned_at,
          timezone,
          job_type
        }
      });
    }catch{}

    return json(200, "ok", {
      created: true,
      id: created.id
    });
  }

  if(!id){
    return json(400, "invalid_input", { error:"id_required" });
  }

  const row = await env.DB.prepare(`
    SELECT id, status
    FROM blogspot_schedule_jobs
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!row){
    return json(404, "not_found", { error:"schedule_not_found" });
  }

  await updateScheduleJob(env, id, {
    planned_at,
    timezone,
    status: String(row.status || "scheduled") === "cancelled" ? "scheduled" : String(row.status || "scheduled"),
    payload_json,
    note,
    queued_job_id: null,
    last_error: null
  });

  await env.DB.prepare(`
    UPDATE blogspot_schedule_jobs
    SET site_id=?,
        item_kind=?,
        item_id=?,
        job_type=?,
        updated_at=?
    WHERE id=?
  `).bind(
    activeSite?.id || null,
    item_kind,
    item_id,
    job_type,
    nowSec(),
    id
  ).run();

  try{
    await appendLedgerEvent(env, {
      event_type: "schedule_update",
      site_id: activeSite?.id || null,
      item_kind,
      item_id,
      actor_user_id: a.uid || null,
      payload: {
        schedule_id: id,
        planned_at,
        timezone,
        job_type
      }
    });
  }catch{}

  return json(200, "ok", {
    updated: true,
    id
  });
}
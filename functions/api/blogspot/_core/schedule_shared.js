import { nowSec } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";

export async function requireScheduleAccess(env, request, allowStaff = true){
  return await requireBlogspotAccess(env, request, allowStaff);
}

export function safeJsonParse(v, fallback = null){
  try{
    const x = JSON.parse(String(v || ""));
    return x ?? fallback;
  }catch{
    return fallback;
  }
}

export function cleanItemKind(v){
  const x = String(v || "").trim().toLowerCase();
  return ["post", "page"].includes(x) ? x : "";
}

export function cleanJobType(v, itemKind = ""){
  const x = String(v || "").trim().toLowerCase();
  if(x) return x;
  if(itemKind === "post") return "publish_post";
  if(itemKind === "page") return "publish_page";
  return "";
}

export async function loadLocalScheduledItem(env, itemKind, itemId){
  const kind = cleanItemKind(itemKind);
  const id = String(itemId || "").trim();
  if(!kind || !id) return null;

  if(kind === "post"){
    return await env.DB.prepare(`
      SELECT id, title, slug, status, updated_at, created_at
      FROM cms_posts
      WHERE id=?
      LIMIT 1
    `).bind(id).first();
  }

  return await env.DB.prepare(`
    SELECT id, title, slug, status, updated_at, created_at
    FROM cms_pages
    WHERE id=?
    LIMIT 1
  `).bind(id).first();
}

export async function createScheduleJob(env, {
  site_id = null,
  item_kind,
  item_id,
  job_type,
  planned_at,
  timezone = "Asia/Jakarta",
  payload_json = {},
  note = "",
  created_by = null
}){
  const id = crypto.randomUUID();
  const ts = nowSec();

  await env.DB.prepare(`
    INSERT INTO blogspot_schedule_jobs (
      id, site_id, item_kind, item_id, job_type, planned_at, timezone,
      status, payload_json, note, queued_job_id, last_error,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, NULL, NULL, ?, ?, ?)
  `).bind(
    id,
    site_id || null,
    String(item_kind || ""),
    String(item_id || ""),
    String(job_type || ""),
    Number(planned_at || 0),
    String(timezone || "Asia/Jakarta"),
    JSON.stringify(payload_json || {}),
    String(note || ""),
    created_by,
    ts,
    ts
  ).run();

  return { id };
}

export async function updateScheduleJob(env, id, patch = {}){
  await env.DB.prepare(`
    UPDATE blogspot_schedule_jobs
    SET planned_at=?,
        timezone=?,
        status=?,
        payload_json=?,
        note=?,
        queued_job_id=?,
        last_error=?,
        updated_at=?
    WHERE id=?
  `).bind(
    Number(patch.planned_at || 0),
    String(patch.timezone || "Asia/Jakarta"),
    String(patch.status || "scheduled"),
    JSON.stringify(patch.payload_json || {}),
    String(patch.note || ""),
    patch.queued_job_id || null,
    patch.last_error || null,
    nowSec(),
    String(id || "")
  ).run();
}

export async function enqueueFromSchedule(env, scheduleRow, actorUserId = null){
  const mod = await import("./job_enqueue.js");

  const payload_json = {
    ...(safeJsonParse(scheduleRow?.payload_json, {}) || {}),
    site_id: scheduleRow?.site_id || null
  };

  const fakeReq = new Request("https://queue.local/api/blogspot/job_enqueue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      job_type: String(scheduleRow?.job_type || ""),
      payload_json,
      priority: 30,
      max_attempts: 3,
      site_id: scheduleRow?.site_id || null
    })
  });

  const res = await mod.onRequestPost({
    request: fakeReq,
    env,
    __schedule_actor_user_id: actorUserId || null
  });

  const data = await res.json().catch(() => null);

  if(!res.ok || data?.status !== "ok"){
    return {
      ok: false,
      error: data?.data?.error || data?.status || "enqueue_failed",
      data
    };
  }

  return {
    ok: true,
    enqueued: !!data?.data?.enqueued,
    duplicate: !!data?.data?.duplicate,
    job_id: data?.data?.id || ""
  };
}
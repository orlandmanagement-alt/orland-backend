import { json, readJson, requireAuth, hasRole, nowSec, auditEvent } from "../../_lib.js";

function canRead(a){
  return hasRole(a.roles, ["super_admin","admin","staff"]);
}

function canWrite(a){
  return hasRole(a.roles, ["super_admin","admin"]);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const limit = 200;

  const r = await env.DB.prepare(`
    SELECT
      g.id,
      g.name,
      g.rotation,
      g.timezone,
      g.week_start,
      g.created_at,
      g.updated_at,
      (
        SELECT COUNT(*)
        FROM oncall_members m
        WHERE m.group_id = g.id
      ) AS member_count,
      (
        SELECT COUNT(*)
        FROM oncall_members m
        WHERE m.group_id = g.id AND m.active = 1
      ) AS active_member_count
    FROM oncall_groups g
    ORDER BY g.updated_at DESC, g.created_at DESC
    LIMIT ?
  `).bind(limit).all();

  return json(200,"ok",{ items: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const started = Date.now();
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action || "create").trim();
  const now = nowSec();

  if(action === "create"){
    const name = String(body.name || "").trim();
    const rotation = String(body.rotation || "weekly").trim();
    const timezone = String(body.timezone || "UTC").trim();
    const week_start = String(body.week_start || "monday").trim();

    if(!name) return json(400,"invalid_input",{ message:"name_required" });

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO oncall_groups (
        id, name, rotation, timezone, created_at, updated_at, week_start
      )
      VALUES (?,?,?,?,?,?,?)
    `).bind(
      id, name, rotation, timezone, now, now, week_start
    ).run();

    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "oncall_group_create",
      target_type: "oncall_group",
      target_id: id,
      http_status: 200,
      duration_ms: Date.now() - started,
      meta: { name, rotation, timezone, week_start }
    });

    return json(200,"ok",{ created:true, id });
  }

  if(action === "update"){
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const rotation = String(body.rotation || "").trim();
    const timezone = String(body.timezone || "").trim();
    const week_start = String(body.week_start || "").trim();

    if(!id) return json(400,"invalid_input",{ message:"id_required" });

    const row = await env.DB.prepare(`
      SELECT id FROM oncall_groups WHERE id=? LIMIT 1
    `).bind(id).first();

    if(!row) return json(404,"not_found",{ message:"group_not_found" });

    await env.DB.prepare(`
      UPDATE oncall_groups
      SET
        name = COALESCE(?, name),
        rotation = COALESCE(?, rotation),
        timezone = COALESCE(?, timezone),
        week_start = COALESCE(?, week_start),
        updated_at = ?
      WHERE id = ?
    `).bind(
      name || null,
      rotation || null,
      timezone || null,
      week_start || null,
      now,
      id
    ).run();

    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "oncall_group_update",
      target_type: "oncall_group",
      target_id: id,
      http_status: 200,
      duration_ms: Date.now() - started,
      meta: { name, rotation, timezone, week_start }
    });

    return json(200,"ok",{ updated:true, id });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

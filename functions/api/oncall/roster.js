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

  const url = new URL(request.url);
  const group_id = String(url.searchParams.get("group_id") || "").trim();

  if(!group_id) return json(400,"invalid_input",{ message:"group_id_required" });

  const r = await env.DB.prepare(`
    SELECT
      m.id,
      m.group_id,
      m.user_id,
      m.sort_order,
      m.active,
      m.created_at,
      u.display_name,
      u.email_norm
    FROM oncall_members m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.group_id=?
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).bind(group_id).all();

  return json(200,"ok",{ items: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const started = Date.now();
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action || "upsert").trim();
  const now = nowSec();

  if(action === "upsert"){
    const group_id = String(body.group_id || "").trim();
    const user_id = String(body.user_id || "").trim();
    const sort_order = Number(body.sort_order || 0);
    const active = Number(body.active ? 1 : 0);

    if(!group_id || !user_id){
      return json(400,"invalid_input",{ message:"group_id_user_id_required" });
    }

    const g = await env.DB.prepare(`
      SELECT id FROM oncall_groups WHERE id=? LIMIT 1
    `).bind(group_id).first();
    if(!g) return json(404,"not_found",{ message:"group_not_found" });

    const u = await env.DB.prepare(`
      SELECT id FROM users WHERE id=? LIMIT 1
    `).bind(user_id).first();
    if(!u) return json(404,"not_found",{ message:"user_not_found" });

    const existing = await env.DB.prepare(`
      SELECT id FROM oncall_members WHERE group_id=? AND user_id=? LIMIT 1
    `).bind(group_id, user_id).first();

    if(existing){
      await env.DB.prepare(`
        UPDATE oncall_members
        SET sort_order=?, active=?
        WHERE id=?
      `).bind(sort_order, active, existing.id).run();

      await auditEvent(env, request, {
        actor_user_id: a.uid,
        action: "oncall_roster_upsert",
        target_type: "oncall_member",
        target_id: existing.id,
        http_status: 200,
        duration_ms: Date.now() - started,
        meta: { group_id, user_id, sort_order, active, mode:"update" }
      });

      return json(200,"ok",{ updated:true, id: existing.id });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO oncall_members (
        id, group_id, user_id, sort_order, active, created_at
      )
      VALUES (?,?,?,?,?,?)
    `).bind(
      id, group_id, user_id, sort_order, active, now
    ).run();

    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "oncall_roster_upsert",
      target_type: "oncall_member",
      target_id: id,
      http_status: 200,
      duration_ms: Date.now() - started,
      meta: { group_id, user_id, sort_order, active, mode:"create" }
    });

    return json(200,"ok",{ created:true, id });
  }

  if(action === "remove"){
    const id = String(body.id || "").trim();
    if(!id) return json(400,"invalid_input",{ message:"id_required" });

    await env.DB.prepare(`DELETE FROM oncall_members WHERE id=?`).bind(id).run();

    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "oncall_roster_upsert",
      target_type: "oncall_member",
      target_id: id,
      http_status: 200,
      duration_ms: Date.now() - started,
      meta: { mode:"remove" }
    });

    return json(200,"ok",{ removed:true, id });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

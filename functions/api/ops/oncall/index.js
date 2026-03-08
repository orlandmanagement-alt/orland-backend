import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

function clamp(n, lo, hi){
  n = Number(n || 0);
  if(Number.isNaN(n)) n = lo;
  return Math.max(lo, Math.min(hi, n));
}

async function ensureGroup(env, payload){
  const now = nowSec();
  const id = payload.id || crypto.randomUUID();
  const name = String(payload.name || "").trim();
  const rotation = String(payload.rotation || "weekly").trim(); // weekly|daily|custom
  const timezone = String(payload.timezone || "UTC").trim();
  const week_start = String(payload.week_start || "monday").trim(); // monday|sunday

  if(!name || name.length < 2) throw new Error("name_required");

  // upsert group
  const exists = await env.DB.prepare("SELECT id FROM oncall_groups WHERE id=? LIMIT 1").bind(id).first();
  if(exists){
    await env.DB.prepare(`
      UPDATE oncall_groups
      SET name=?, rotation=?, timezone=?, updated_at=?, week_start=?
      WHERE id=?
    `).bind(name, rotation, timezone, now, week_start, id).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO oncall_groups (id,name,rotation,timezone,created_at,updated_at,week_start)
      VALUES (?,?,?,?,?,?,?)
    `).bind(id, name, rotation, timezone, now, now, week_start).run();
  }

  return id;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const group_id = String(url.searchParams.get("group_id") || "").trim();
  const limit = clamp(url.searchParams.get("limit") || 200, 1, 500);

  // list groups
  const g = await env.DB.prepare(`
    SELECT id,name,rotation,timezone,week_start,created_at,updated_at
    FROM oncall_groups
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  // optionally list members of a group
  let members = [];
  if(group_id){
    const m = await env.DB.prepare(`
      SELECT
        om.id, om.group_id, om.user_id, om.sort_order, om.active, om.created_at,
        u.email_norm, u.display_name, u.status
      FROM oncall_members om
      LEFT JOIN users u ON u.id=om.user_id
      WHERE om.group_id=?
      ORDER BY om.sort_order ASC, om.created_at ASC
      LIMIT ?
    `).bind(group_id, limit).all();
    members = m.results || [];
  }

  return json(200,"ok",{ groups: g.results || [], members, group_id: group_id || null });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action || "upsert_group").trim();

  // 1) create/update group
  if(action === "upsert_group"){
    try{
      const id = await ensureGroup(env, body.group || body);
      await audit(env,{ actor_user_id:a.uid, action:"oncall.group.upsert", route:"POST /api/ops/oncall", http_status:200, meta:{group_id:id} });
      return json(200,"ok",{ saved:true, group_id:id });
    }catch(e){
      return json(400,"invalid_input",{ message:String(e?.message||e) });
    }
  }

  // 2) add member to group
  if(action === "add_member"){
    const group_id = String(body.group_id || "").trim();
    const user_id = String(body.user_id || "").trim();
    const sort_order = Number(body.sort_order || 0);
    if(!group_id || !user_id) return json(400,"invalid_input",{ message:"group_id/user_id_required" });

    const now = nowSec();
    const id = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO oncall_members (id,group_id,user_id,sort_order,active,created_at)
      VALUES (?,?,?,?,?,?)
    `).bind(id, group_id, user_id, sort_order, 1, now).run();

    await audit(env,{ actor_user_id:a.uid, action:"oncall.member.add", route:"POST /api/ops/oncall", http_status:200, meta:{group_id,user_id} });
    return json(200,"ok",{ created:true, id });
  }

  // 3) bulk set members (reorder + active)
  if(action === "set_members"){
    const group_id = String(body.group_id || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    if(!group_id) return json(400,"invalid_input",{ message:"group_id_required" });

    const now = nowSec();

    // soft reset: set all inactive first
    await env.DB.prepare(`UPDATE oncall_members SET active=0 WHERE group_id=?`).bind(group_id).run();

    // upsert each member row (keep stable)
    for(const it of items){
      const user_id = String(it.user_id || "").trim();
      if(!user_id) continue;
      const sort_order = Number(it.sort_order || 0);
      const active = it.active ? 1 : 0;

      const ex = await env.DB.prepare(`SELECT id FROM oncall_members WHERE group_id=? AND user_id=? LIMIT 1`)
        .bind(group_id, user_id).first();

      if(ex){
        await env.DB.prepare(`UPDATE oncall_members SET sort_order=?, active=? WHERE id=?`)
          .bind(sort_order, active, ex.id).run();
      }else{
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO oncall_members (id,group_id,user_id,sort_order,active,created_at)
          VALUES (?,?,?,?,?,?)
        `).bind(id, group_id, user_id, sort_order, active, now).run();
      }
    }

    await audit(env,{ actor_user_id:a.uid, action:"oncall.members.set", route:"POST /api/ops/oncall", http_status:200, meta:{group_id,count:items.length} });
    return json(200,"ok",{ saved:true, updated_at: now });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action || "").trim();

  // update member fields
  if(action === "update_member"){
    const id = String(body.id || "").trim();
    if(!id) return json(400,"invalid_input",{ message:"id_required" });
    const sort_order = body.sort_order != null ? Number(body.sort_order) : null;
    const active = body.active != null ? (body.active ? 1 : 0) : null;

    const sets = [];
    const binds = [];

    if(sort_order != null){ sets.push("sort_order=?"); binds.push(sort_order); }
    if(active != null){ sets.push("active=?"); binds.push(active); }
    if(!sets.length) return json(400,"invalid_input",{ message:"nothing_to_update" });

    binds.push(id);
    await env.DB.prepare(`UPDATE oncall_members SET ${sets.join(", ")} WHERE id=?`).bind(...binds).run();

    await audit(env,{ actor_user_id:a.uid, action:"oncall.member.update", route:"PUT /api/ops/oncall", http_status:200, meta:{id} });
    return json(200,"ok",{ updated:true });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const action = String(url.searchParams.get("action") || "").trim();

  if(action === "delete_group"){
    const group_id = String(url.searchParams.get("group_id") || "").trim();
    if(!group_id) return json(400,"invalid_input",{ message:"group_id_required" });
    await env.DB.prepare(`DELETE FROM oncall_members WHERE group_id=?`).bind(group_id).run();
    await env.DB.prepare(`DELETE FROM oncall_groups WHERE id=?`).bind(group_id).run();
    await audit(env,{ actor_user_id:a.uid, action:"oncall.group.delete", route:"DELETE /api/ops/oncall", http_status:200, meta:{group_id} });
    return json(200,"ok",{ deleted:true });
  }

  if(action === "delete_member"){
    const id = String(url.searchParams.get("id") || "").trim();
    if(!id) return json(400,"invalid_input",{ message:"id_required" });
    await env.DB.prepare(`DELETE FROM oncall_members WHERE id=?`).bind(id).run();
    await audit(env,{ actor_user_id:a.uid, action:"oncall.member.delete", route:"DELETE /api/ops/oncall", http_status:200, meta:{id} });
    return json(200,"ok",{ deleted:true });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

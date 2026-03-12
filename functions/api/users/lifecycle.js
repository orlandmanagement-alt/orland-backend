import { json, readJson, requireAuth, hasRole, nowSec, revokeAllSessionsForUser } from "../../_lib.js";

const ALLOWED = new Set(["invited", "active", "suspended", "locked", "archived"]);

async function hasUserColumn(env, col){
  try{
    const r = await env.DB.prepare(`PRAGMA table_info(users)`).all();
    return (r.results || []).some(x => String(x.name || "").toLowerCase() === String(col || "").toLowerCase());
  }catch{
    return false;
  }
}

async function getUsers(env){
  const r = await env.DB.prepare(`
    SELECT id, email_norm, display_name, status, created_at, updated_at,
           disabled_at, disabled_reason, locked_until, lock_reason,
           must_change_password, mfa_enabled
    FROM users
    ORDER BY updated_at DESC, created_at DESC
  `).all();

  return (r.results || []).map(x => ({
    id: String(x.id || ""),
    email_norm: String(x.email_norm || ""),
    display_name: String(x.display_name || ""),
    status: String(x.status || ""),
    created_at: Number(x.created_at || 0),
    updated_at: Number(x.updated_at || 0),
    disabled_at: x.disabled_at == null ? null : Number(x.disabled_at),
    disabled_reason: x.disabled_reason || null,
    locked_until: x.locked_until == null ? null : Number(x.locked_until),
    lock_reason: x.lock_reason || null,
    must_change_password: Number(x.must_change_password || 0) === 1,
    mfa_enabled: Number(x.mfa_enabled || 0) === 1
  }));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin"])){
    return json(403, "forbidden", null);
  }

  const items = await getUsers(env);
  return json(200, "ok", { items });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const user_id = String(body.user_id || "").trim();
  const action = String(body.action || "").trim().toLowerCase();
  const reason = String(body.reason || "").trim() || null;
  const now = nowSec();

  if(!user_id) return json(400, "invalid_input", { message:"user_id_required" });

  const user = await env.DB.prepare(`
    SELECT id, status, session_version
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(user_id).first();

  if(!user) return json(404, "not_found", { message:"user_not_found" });

  if(action === "set_status"){
    const status = String(body.status || "").trim().toLowerCase();
    if(!ALLOWED.has(status)){
      return json(400, "invalid_input", { message:"invalid_status" });
    }

    const hasDisabledAt = await hasUserColumn(env, "disabled_at");
    const hasDisabledReason = await hasUserColumn(env, "disabled_reason");

    if(hasDisabledAt && hasDisabledReason){
      await env.DB.prepare(`
        UPDATE users
        SET status = ?,
            updated_at = ?,
            disabled_at = CASE WHEN ? IN ('suspended','archived') THEN ? ELSE NULL END,
            disabled_reason = CASE WHEN ? IN ('suspended','archived') THEN ? ELSE NULL END
        WHERE id = ?
      `).bind(status, now, status, now, status, reason, user_id).run();
    }else{
      await env.DB.prepare(`
        UPDATE users
        SET status = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(status, now, user_id).run();
    }

    if(status !== "active"){
      await revokeAllSessionsForUser(env, user_id, "user_lifecycle_status_change");
    }

    return json(200, "ok", {
      updated: true,
      user_id,
      status
    });
  }

  if(action === "force_password_reset"){
    await env.DB.prepare(`
      UPDATE users
      SET must_change_password = 1,
          updated_at = ?
      WHERE id = ?
    `).bind(now, user_id).run();

    await revokeAllSessionsForUser(env, user_id, "force_password_reset");
    return json(200, "ok", { updated: true, user_id, must_change_password: true });
  }

  if(action === "clear_lock"){
    await env.DB.prepare(`
      UPDATE users
      SET locked_until = NULL,
          lock_reason = NULL,
          pw_fail_count = 0,
          pw_fail_last_at = NULL,
          updated_at = ?
      WHERE id = ?
    `).bind(now, user_id).run();

    return json(200, "ok", { cleared: true, user_id });
  }

  if(action === "archive"){
    const hasDisabledAt = await hasUserColumn(env, "disabled_at");
    const hasDisabledReason = await hasUserColumn(env, "disabled_reason");

    if(hasDisabledAt && hasDisabledReason){
      await env.DB.prepare(`
        UPDATE users
        SET status = 'archived',
            disabled_at = ?,
            disabled_reason = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(now, reason || "archived_by_admin", now, user_id).run();
    }else{
      await env.DB.prepare(`
        UPDATE users
        SET status = 'archived',
            updated_at = ?
        WHERE id = ?
      `).bind(now, user_id).run();
    }

    await revokeAllSessionsForUser(env, user_id, "user_archived");
    return json(200, "ok", { archived: true, user_id });
  }

  return json(400, "invalid_input", { message:"invalid_action" });
}

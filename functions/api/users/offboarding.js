import {
  json, readJson, requireAuth, hasRole, nowSec,
  revokeAllSessionsForUser
} from "../../_lib.js";

async function getUserRoles(env, user_id){
  const r = await env.DB.prepare(`
    SELECT ur.role_id, ro.name
    FROM user_roles ur
    JOIN roles ro ON ro.id = ur.role_id
    WHERE ur.user_id = ?
    ORDER BY ro.name ASC
  `).bind(user_id).all();

  return (r.results || []).map(x => ({
    role_id: String(x.role_id || ""),
    role_name: String(x.name || "")
  }));
}

async function listUsers(env){
  const r = await env.DB.prepare(`
    SELECT id, email_norm, display_name, status, disabled_at, disabled_reason,
           must_change_password, mfa_enabled, updated_at, created_at
    FROM users
    ORDER BY updated_at DESC, created_at DESC
  `).all();

  const rows = r.results || [];
  const out = [];
  for(const row of rows){
    const roles = await getUserRoles(env, row.id);
    out.push({
      id: String(row.id || ""),
      email_norm: String(row.email_norm || ""),
      display_name: String(row.display_name || ""),
      status: String(row.status || ""),
      disabled_at: row.disabled_at == null ? null : Number(row.disabled_at),
      disabled_reason: row.disabled_reason || null,
      must_change_password: Number(row.must_change_password || 0) === 1,
      mfa_enabled: Number(row.mfa_enabled || 0) === 1,
      updated_at: Number(row.updated_at || 0),
      created_at: Number(row.created_at || 0),
      roles
    });
  }
  return out;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin"])){
    return json(403, "forbidden", null);
  }

  const items = await listUsers(env);
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
  const reason = String(body.reason || "").trim() || "offboarded_by_admin";
  const revoke_roles = body.revoke_roles ? 1 : 0;
  const force_archive = body.force_archive ? 1 : 0;
  const now = nowSec();

  if(!user_id){
    return json(400, "invalid_input", { message:"user_id_required" });
  }

  const user = await env.DB.prepare(`
    SELECT id, status
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(user_id).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  await env.DB.prepare(`
    UPDATE users
    SET status = ?,
        disabled_at = ?,
        disabled_reason = ?,
        must_change_password = 1,
        updated_at = ?
    WHERE id = ?
  `).bind(force_archive ? "archived" : "suspended", now, reason, now, user_id).run();

  await revokeAllSessionsForUser(env, user_id, "user_offboarding");

  if(revoke_roles){
    await env.DB.prepare(`
      DELETE FROM user_roles
      WHERE user_id = ?
    `).bind(user_id).run();
  }

  return json(200, "ok", {
    offboarded: true,
    user_id,
    status: force_archive ? "archived" : "suspended",
    revoke_roles: !!revoke_roles
  });
}

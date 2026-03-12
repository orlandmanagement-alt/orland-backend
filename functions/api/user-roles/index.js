import { json, requireAuth, hasRole } from "../../_lib.js";

async function getUserRow(env, userId){
  return await env.DB.prepare(`
    SELECT id, email_norm, display_name, status, session_version, locked_until, lock_reason
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
}

async function getCurrentRoleIdsForUser(env, userId){
  const r = await env.DB.prepare(`
    SELECT role_id
    FROM user_roles
    WHERE user_id = ?
    ORDER BY created_at ASC
  `).bind(userId).all();

  return (r.results || []).map(x => String(x.role_id || ""));
}

async function listRoles(env){
  const r = await env.DB.prepare(`
    SELECT id, name, created_at
    FROM roles
    ORDER BY name ASC, created_at ASC
  `).all();

  return (r.results || []).map(x => ({
    id: String(x.id || ""),
    name: String(x.name || ""),
    created_at: Number(x.created_at || 0)
  }));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const user_id = String(url.searchParams.get("user_id") || "").trim();

  if(!user_id){
    return json(400, "invalid_input", { message:"user_id_required" });
  }

  const user = await getUserRow(env, user_id);
  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  const [role_ids, all_roles] = await Promise.all([
    getCurrentRoleIdsForUser(env, user_id),
    listRoles(env)
  ]);

  return json(200, "ok", {
    user: {
      id: String(user.id || ""),
      email_norm: user.email_norm || null,
      display_name: user.display_name || null,
      status: user.status || null,
      session_version: Number(user.session_version || 1),
      locked_until: user.locked_until == null ? null : Number(user.locked_until),
      lock_reason: user.lock_reason || null
    },
    role_ids,
    all_roles
  });
}

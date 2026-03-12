import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

const SENSITIVE_ROLE_IDS = new Set([
  "role_super_admin",
  "role_security_admin"
]);

function uniqStrings(arr){
  return Array.from(new Set(
    (Array.isArray(arr) ? arr : [])
      .map(x => String(x || "").trim())
      .filter(Boolean)
  ));
}

async function getUserRow(env, userId){
  return await env.DB.prepare(`
    SELECT id, email_norm, display_name, status
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

async function getAllRoleIds(env){
  const r = await env.DB.prepare(`
    SELECT id
    FROM roles
  `).all();

  return new Set((r.results || []).map(x => String(x.id || "")));
}

async function countUsersWithRole(env, roleId){
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM user_roles
    WHERE role_id = ?
  `).bind(roleId).first();

  return Number(row?.total || 0);
}

async function replaceUserRoles(env, userId, roleIds){
  await env.DB.prepare(`
    DELETE FROM user_roles
    WHERE user_id = ?
  `).bind(userId).run();

  const now = nowSec();
  for(const roleId of uniqStrings(roleIds)){
    await env.DB.prepare(`
      INSERT INTO user_roles (user_id, role_id, created_at)
      VALUES (?, ?, ?)
    `).bind(userId, roleId, now).run();
  }
}

function hasSensitiveRole(roleIds){
  return uniqStrings(roleIds).some(x => SENSITIVE_ROLE_IDS.has(x));
}

function removedSensitiveRoles(currentRoleIds, nextRoleIds){
  const current = new Set(uniqStrings(currentRoleIds));
  const next = new Set(uniqStrings(nextRoleIds));
  return Array.from(SENSITIVE_ROLE_IDS).filter(roleId => current.has(roleId) && !next.has(roleId));
}

export async function onRequestGet(ctx){
  const { request, env } = ctx;
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

  const role_ids = await getCurrentRoleIdsForUser(env, user_id);

  return json(200, "ok", {
    user,
    role_ids,
    sensitive_role_ids: Array.from(SENSITIVE_ROLE_IDS)
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const user_id = String(body.user_id || "").trim();
  const role_ids = uniqStrings(body.role_ids);

  if(!user_id){
    return json(400, "invalid_input", { message:"user_id_required" });
  }

  const user = await getUserRow(env, user_id);
  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  const validRoleIds = await getAllRoleIds(env);
  const invalidRoleIds = role_ids.filter(x => !validRoleIds.has(x));
  if(invalidRoleIds.length){
    return json(400, "invalid_input", {
      message: "invalid_role_ids",
      invalid_role_ids: invalidRoleIds
    });
  }

  const actorIsSuperAdmin = hasRole(a.roles, ["super_admin"]);
  const currentRoleIds = await getCurrentRoleIdsForUser(env, user_id);

  const assigningSensitive = hasSensitiveRole(role_ids);
  const removingSensitive = removedSensitiveRoles(currentRoleIds, role_ids);

  if((assigningSensitive || removingSensitive.length) && !actorIsSuperAdmin){
    return json(403, "protected_user_role_assignment_denied", {
      message: "only_super_admin_can_assign_or_remove_sensitive_roles",
      sensitive_role_ids: Array.from(SENSITIVE_ROLE_IDS),
      removed_sensitive_role_ids: removingSensitive
    });
  }

  if(removingSensitive.includes("role_super_admin")){
    const totalSuperAdmins = await countUsersWithRole(env, "role_super_admin");
    const targetCurrentlySuperAdmin = currentRoleIds.includes("role_super_admin");

    if(targetCurrentlySuperAdmin && totalSuperAdmins <= 1){
      return json(400, "protected_user_role_assignment_denied", {
        message: "cannot_remove_last_super_admin",
        user_id,
        role_id: "role_super_admin",
        total_super_admin_users: totalSuperAdmins
      });
    }
  }

  if(String(a.uid || "") === user_id){
    const actorLosesSuperAdmin =
      currentRoleIds.includes("role_super_admin") &&
      !role_ids.includes("role_super_admin");

    if(actorLosesSuperAdmin){
      const totalSuperAdmins = await countUsersWithRole(env, "role_super_admin");
      if(totalSuperAdmins <= 1){
        return json(400, "protected_user_role_assignment_denied", {
          message: "cannot_self_remove_last_super_admin",
          user_id,
          role_id: "role_super_admin",
          total_super_admin_users: totalSuperAdmins
        });
      }
    }
  }

  await replaceUserRoles(env, user_id, role_ids);
  const saved = await getCurrentRoleIdsForUser(env, user_id);

  return json(200, "ok", {
    saved: true,
    user: {
      id: String(user.id || ""),
      email_norm: user.email_norm || null,
      display_name: user.display_name || null,
      status: user.status || null
    },
    role_ids: saved,
    sensitive_role_ids: Array.from(SENSITIVE_ROLE_IDS)
  });
}

import { json, requireAuth, nowSec, hasRole } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const roles = a.roles || [];
  const now = nowSec();

  // v1: self-fulfill internal/dev, admin/super_admin also allowed
  const allowed = hasRole(roles, ["super_admin","admin","staff","client","talent"]);
  if(!allowed){
    return json(403, "forbidden", null);
  }

  const hasEmailVerifiedColumn = await env.DB.prepare(`
    SELECT 1 AS ok
    FROM pragma_table_info('users')
    WHERE name='email_verified'
    LIMIT 1
  `).first();

  if(!hasEmailVerifiedColumn){
    return json(400, "invalid_input", { message: "users_email_verified_column_missing" });
  }

  await env.DB.prepare(`
    UPDATE users
    SET email_verified=1,
        email_verified_at=?,
        updated_at=?
    WHERE id=?
  `).bind(now, now, a.user.id).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    a.user.id,
    "verification_email_completed",
    "user",
    a.user.id,
    JSON.stringify({ mode: "internal_dev_v1" }),
    now
  ).run();

  return json(200, "ok", {
    verified: true,
    channel: "email",
    mode: "internal_dev_v1"
  });
}

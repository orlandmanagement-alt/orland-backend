import { json, requireAuth, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO user_security (user_id, email_2fa_enabled, updated_at)
    VALUES (?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      email_2fa_enabled=1,
      updated_at=excluded.updated_at
  `).bind(a.user.id, now).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    a.user.id,
    "two_step_enabled",
    "user",
    a.user.id,
    JSON.stringify({ method: "email_2fa_flag_v1" }),
    now
  ).run();

  return json(200, "ok", {
    enabled: true,
    method: "email_2fa_flag_v1"
  });
}

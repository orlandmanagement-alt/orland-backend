import { json, requireAuth, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    a.user.id,
    "verification_email_send_requested",
    "user",
    a.user.id,
    JSON.stringify({
      email_norm: a.user.email_norm || "",
      mode: "placeholder_v1"
    }),
    now
  ).run();

  return json(200, "ok", {
    sent: true,
    channel: "email",
    mode: "placeholder_v1",
    message: "verification_email_request_recorded"
  });
}

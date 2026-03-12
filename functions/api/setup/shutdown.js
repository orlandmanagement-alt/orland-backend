import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

const BOOTSTRAP_LOCK_KEY = "bootstrap_superadmin_lock_v1";

async function lockBootstrap(env){
  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, is_secret, updated_at)
    VALUES (?, ?, 0, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      is_secret = excluded.is_secret,
      updated_at = excluded.updated_at
  `).bind(BOOTSTRAP_LOCK_KEY, "1", nowSec()).run();
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin"])){
    return json(403, "forbidden", { message:"only_super_admin_can_shutdown_bootstrap" });
  }

  await lockBootstrap(env);

  return json(200, "ok", {
    bootstrap_locked: true,
    shutdown: true
  });
}

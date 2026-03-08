import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;

  // only super_admin can see lock list
  if (!hasRole(a.roles, ["super_admin"])) return json(403, "forbidden", null);

  const now = nowSec();

  // columns expected:
  // users.locked_until (INTEGER), users.lock_reason (TEXT), users.pw_fail_count (INTEGER), users.pw_fail_window_start (INTEGER)
  const r = await env.DB.prepare(`
    SELECT
      id, email_norm, display_name, status,
      COALESCE(locked_until,0) AS locked_until,
      COALESCE(lock_reason,'') AS lock_reason,
      COALESCE(pw_fail_count,0) AS pw_fail_count,
      COALESCE(pw_fail_window_start,0) AS pw_fail_window_start,
      updated_at
    FROM users
    WHERE COALESCE(locked_until,0) > ?
    ORDER BY locked_until DESC
    LIMIT 500
  `).bind(now).all();

  return json(200, "ok", { now, locks: r.results || [] });
}

import { json, requireAuth, hasRole, nowSec } from "../../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const now = nowSec();

  const before = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM ip_blocks
    WHERE revoked_at IS NOT NULL
       OR expires_at <= ?
  `).bind(now).first();

  await env.DB.prepare(`
    DELETE FROM ip_blocks
    WHERE revoked_at IS NOT NULL
       OR expires_at <= ?
  `).bind(now).run();

  return json(200, "ok", {
    purged: Number(before?.total || 0)
  });
}

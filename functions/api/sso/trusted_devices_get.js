import {
  json,
  requireAuth
} from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  const r = await env.DB.prepare(`
    SELECT
      id,
      device_name,
      status,
      last_seen_at,
      created_at,
      updated_at
    FROM sso_trusted_devices
    WHERE user_id = ?
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 100
  `).bind(auth.uid).all();

  return json(200, "ok", {
    items: (r.results || []).map(row => ({
      id: row.id,
      device_name: row.device_name || "",
      status: row.status || "",
      last_seen_at: row.last_seen_at || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    }))
  });
}

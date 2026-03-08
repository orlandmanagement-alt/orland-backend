import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||100)));

  // lockout stored in system_settings:
  // k = "lockout:<user_id>"
  // v = JSON {"unlock_at":<epoch>,"reason":"password_fail","cnt":N,"window_start":<epoch>}
  const r = await env.DB.prepare(`
    SELECT s.k, s.v, u.email_norm
    FROM system_settings s
    LEFT JOIN users u ON u.id = substr(s.k, 9)
    WHERE s.k LIKE 'lockout:%'
    ORDER BY s.updated_at DESC
    LIMIT ?
  `).bind(limit).all();

  const now = nowSec();
  const rows = (r.results||[]).map(x=>{
    const user_id = String(x.k||"").slice(8);
    let doc = {};
    try{ doc = JSON.parse(x.v||"{}"); }catch{}
    return {
      user_id,
      email_norm: x.email_norm || null,
      reason: doc.reason || "lockout",
      unlock_at: Number(doc.unlock_at||0),
      active: Number(doc.unlock_at||0) > now,
      cnt: Number(doc.cnt||0),
      window_start: Number(doc.window_start||0),
    };
  });

  return json(200,"ok",{ rows });
}

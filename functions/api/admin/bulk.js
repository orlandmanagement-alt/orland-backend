import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action||"").trim();
  const before_days = Math.min(3650, Math.max(0, Number(body.before_days||0)));
  const now = nowSec();
  const before = before_days ? (now - (before_days*86400)) : null;

  let changed = 0;

  if(action==="clear_audit"){
    const r = before
      ? await env.DB.prepare(`DELETE FROM audit_logs WHERE created_at < ?`).bind(before).run()
      : await env.DB.prepare(`DELETE FROM audit_logs`).run();
    changed = r?.meta?.changes || 0;
    return json(200,"ok",{ action, changed });
  }

  if(action==="clear_sessions_revoked"){
    const r = before
      ? await env.DB.prepare(`DELETE FROM sessions WHERE revoked_at IS NOT NULL AND created_at < ?`).bind(before).run()
      : await env.DB.prepare(`DELETE FROM sessions WHERE revoked_at IS NOT NULL`).run();
    changed = r?.meta?.changes || 0;
    return json(200,"ok",{ action, changed });
  }

  if(action==="clear_incidents_closed"){
    const r = before
      ? await env.DB.prepare(`DELETE FROM incidents WHERE status='closed' AND updated_at < ?`).bind(before).run()
      : await env.DB.prepare(`DELETE FROM incidents WHERE status='closed'`).run();
    changed = r?.meta?.changes || 0;
    return json(200,"ok",{ action, changed });
  }

  if(action==="clear_metrics_hourly"){
    const r = before
      ? await env.DB.prepare(`DELETE FROM hourly_metrics WHERE updated_at < ?`).bind(before).run()
      : await env.DB.prepare(`DELETE FROM hourly_metrics`).run();
    changed = r?.meta?.changes || 0;
    return json(200,"ok",{ action, changed });
  }

  if(action==="clear_metrics_daily"){
    const r = before
      ? await env.DB.prepare(`DELETE FROM daily_metrics WHERE updated_at < ?`).bind(before).run()
      : await env.DB.prepare(`DELETE FROM daily_metrics`).run();
    changed = r?.meta?.changes || 0;
    return json(200,"ok",{ action, changed });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function isSA(a){ return hasRole(a.roles, ["super_admin"]); }

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!isSA(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const actions = Array.isArray(body.actions) ? body.actions : [];
  const now = nowSec();

  const out = { done: [], skipped: [], now };

  for(const act of actions){
    const x = String(act||"").trim();

    if(x === "clear_audit"){
      await env.DB.prepare(`DELETE FROM audit_logs`).run();
      out.done.push(x);
      continue;
    }

    if(x === "clear_hourly_metrics"){
      await env.DB.prepare(`DELETE FROM hourly_metrics`).run();
      out.done.push(x);
      continue;
    }

    if(x === "clear_ip_activity"){
      await env.DB.prepare(`DELETE FROM ip_activity`).run();
      out.done.push(x);
      continue;
    }

    if(x === "revoke_all_sessions"){
      await env.DB.prepare(`UPDATE sessions SET revoked_at=? WHERE revoked_at IS NULL`).bind(now).run();
      out.done.push(x);
      continue;
    }

    if(x === "clear_incidents"){
      await env.DB.prepare(`DELETE FROM incidents`).run();
      out.done.push(x);
      continue;
    }

    out.skipped.push(x);
  }

  return json(200,"ok", out);
}

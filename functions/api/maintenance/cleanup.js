import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function isDangerAllowed(env){
  return String(env.ALLOW_DANGEROUS_ADMIN||"").trim() === "1";
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action||"").trim();
  const confirm = String(body.confirm||"").trim();
  const now = nowSec();

  // safe windows
  const day = 86400;
  const cutoff30 = now - (30*day);
  const cutoff60 = now - (60*day);
  const cutoff7  = now - (7*day);

  async function run(sql, ...bind){
    const r = await env.DB.prepare(sql).bind(...bind).run();
    return r?.meta?.changes || 0;
  }

  if(action === "clear_audit_30d"){
    const n = await run(`DELETE FROM audit_logs WHERE created_at < ?`, cutoff30);
    return json(200,"ok",{ action, deleted:n });
  }

  if(action === "clear_hourly_30d"){
    const n = await run(`DELETE FROM hourly_metrics WHERE hour_epoch < ?`, cutoff30);
    return json(200,"ok",{ action, deleted:n });
  }

  if(action === "clear_ip_activity_7d"){
    const n = await run(`DELETE FROM ip_activity WHERE window_start < ?`, cutoff7);
    return json(200,"ok",{ action, deleted:n });
  }

  if(action === "revoke_expired_sessions"){
    const n = await run(`UPDATE sessions SET revoked_at=? WHERE revoked_at IS NULL AND expires_at < ?`, now, now);
    return json(200,"ok",{ action, revoked:n });
  }

  if(action === "clear_closed_incidents_60d"){
    const n = await run(`DELETE FROM incidents WHERE status='closed' AND updated_at < ?`, cutoff60);
    return json(200,"ok",{ action, deleted:n });
  }

  // ----------------- DANGER ZONE -----------------
  if(action === "wipe_ops_data" || action === "wipe_sessions_all"){
    if(!isDangerAllowed(env)) return json(403,"forbidden",{ message:"danger_disabled", hint:"Set ALLOW_DANGEROUS_ADMIN=1" });
    if(confirm !== "ORLAND-DELETE") return json(400,"invalid_input",{ message:"confirm_required", confirm:"ORLAND-DELETE" });

    if(action === "wipe_sessions_all"){
      const n = await run(`DELETE FROM sessions`);
      return json(200,"ok",{ action, deleted:n });
    }

    if(action === "wipe_ops_data"){
      const a1 = await run(`DELETE FROM incidents`);
      const a2 = await run(`DELETE FROM hourly_metrics`);
      const a3 = await run(`DELETE FROM ip_activity`);
      const a4 = await run(`DELETE FROM audit_logs`);
      return json(200,"ok",{ action, deleted:{ incidents:a1, hourly_metrics:a2, ip_activity:a3, audit_logs:a4 }});
    }
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

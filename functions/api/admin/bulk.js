import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action||"");
  const now = nowSec();

  if(action === "clear_audit"){
    const r = await env.DB.prepare("DELETE FROM audit_logs").run();
    return json(200,"ok",{ action, deleted: r?.meta?.changes || 0 });
  }

  if(action === "purge_sessions"){
    const r1 = await env.DB.prepare("DELETE FROM sessions WHERE revoked_at IS NOT NULL").run();
    const r2 = await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now).run();
    return json(200,"ok",{ action, deleted_revoked: r1?.meta?.changes||0, deleted_expired: r2?.meta?.changes||0 });
  }

  if(action === "clear_tasks"){
    const r = await env.DB.prepare("DELETE FROM tasks").run();
    return json(200,"ok",{ action, deleted: r?.meta?.changes || 0 });
  }

  if(action === "clear_dlq"){
    const r = await env.DB.prepare("DELETE FROM dlq").run();
    return json(200,"ok",{ action, deleted: r?.meta?.changes || 0 });
  }

  if(action === "purge_ipblocks"){
    const r = await env.DB.prepare("UPDATE ip_blocks SET revoked_at=? WHERE revoked_at IS NULL AND expires_at < ?").bind(now, now).run();
    return json(200,"ok",{ action, revoked: r?.meta?.changes || 0 });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}

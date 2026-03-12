import { json, readJson, requireAuth, revokeAllSessionsForUser, nowSec, auditEvent, sha256Base64 } from "../../_lib.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const include_current = body.include_current === true;

  if(include_current){
    await revokeAllSessionsForUser(env, a.uid, "user_revoke_all_sessions");
  }else{
    await env.DB.prepare(`
      UPDATE sessions
      SET revoked_at = ?, revoke_reason = ?
      WHERE user_id = ?
        AND revoked_at IS NULL
        AND id <> ?
    `).bind(nowSec(), "user_revoke_other_sessions", a.uid, a.sid).run();
  }

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: include_current ? "session_revoke_all_self" : "session_revoke_others_self",
      ip_hash: ipHash,
      http_status: 200,
      meta: {
        include_current
      }
    });
  }catch{}

  return json(200, "ok", {
    revoked: true,
    include_current
  });
}

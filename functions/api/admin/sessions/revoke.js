import { json, readJson, requireAuth, hasRole, revokeSessionBySid, auditEvent, sha256Base64 } from "../../../_lib.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const sid = String(body.sid || "").trim();

  if(!sid){
    return json(400, "invalid_input", { message:"sid_required" });
  }

  const row = await env.DB.prepare(`
    SELECT id, user_id, revoked_at
    FROM sessions
    WHERE id = ?
    LIMIT 1
  `).bind(sid).first();

  if(!row){
    return json(404, "not_found", { message:"session_not_found" });
  }

  await revokeSessionBySid(env, sid, "admin_revoke_session");

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "admin_revoke_session",
      ip_hash: ipHash,
      http_status: 200,
      meta: {
        target_user_id: row.user_id || null,
        target_sid: sid
      }
    });
  }catch{}

  return json(200, "ok", {
    revoked: true,
    sid,
    user_id: row.user_id || null
  });
}

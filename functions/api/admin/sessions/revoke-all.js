import { json, readJson, requireAuth, hasRole, revokeAllSessionsForUser, auditEvent, sha256Base64 } from "../../../_lib.js";

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
  const user_id = String(body.user_id || "").trim();

  if(!user_id){
    return json(400, "invalid_input", { message:"user_id_required" });
  }

  const user = await env.DB.prepare(`
    SELECT id, email_norm, display_name
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(user_id).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  await revokeAllSessionsForUser(env, user_id, "admin_revoke_all_sessions");

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "admin_revoke_all_sessions",
      ip_hash: ipHash,
      http_status: 200,
      meta: {
        target_user_id: user_id,
        target_email_norm: user.email_norm || null
      }
    });
  }catch{}

  return json(200, "ok", {
    revoked: true,
    user_id
  });
}

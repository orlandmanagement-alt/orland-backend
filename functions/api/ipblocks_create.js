import { json, readJson, requireAuth, hasRole, nowSec, sha256Base64 } from "../_lib.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const ip = String(body.ip || "").trim();
  const reason = String(body.reason || "manual_block").trim();
  const ttl = Math.max(60, Number(body.ttl || 86400));

  if(!ip) return json(400,"invalid_input",{ message:"ip_required" });

  const now = nowSec();
  const expires_at = now + ttl;
  const ip_hash = await hashIp(env, ip);
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO ip_blocks (
      id, ip_hash, reason, expires_at, revoked_at, created_at, created_by_user_id
    )
    VALUES (?,?,?,?,?,?,?)
  `).bind(
    id, ip_hash, reason, expires_at, null, now, a.uid
  ).run();

  return json(200,"ok",{ created:true, id, expires_at });
}

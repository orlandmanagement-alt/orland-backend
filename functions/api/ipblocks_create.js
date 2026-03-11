import { json, readJson, requireAuth, hasRole, nowSec, sha256Base64 } from "../_lib.js";

function s(v){ return String(v || "").trim(); }

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

function validIp(v){
  const ip = s(v);
  const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  return ipv4.test(ip) || ipv6.test(ip);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const ip = s(body.ip);
  const reason = s(body.reason);
  const ttl_minutes = Math.max(1, Number(body.ttl_minutes || 60));
  const now = nowSec();

  if(!ip) return json(400, "invalid_input", { message:"ip_required" });
  if(!validIp(ip)) return json(400, "invalid_input", { message:"ip_invalid" });
  if(!reason) return json(400, "invalid_input", { message:"reason_required" });

  const ip_hash = await hashIp(env, ip);
  const expires_at = now + (ttl_minutes * 60);

  const active = await env.DB.prepare(`
    SELECT id
    FROM ip_blocks
    WHERE ip_hash=?
      AND revoked_at IS NULL
      AND expires_at > ?
    LIMIT 1
  `).bind(ip_hash, now).first();

  if(active){
    return json(400, "invalid_input", { message:"ip_already_blocked" });
  }

  const id = "ipb_" + crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO ip_blocks (
      id, ip_hash, reason, expires_at, revoked_at, created_at, created_by_user_id
    ) VALUES (?, ?, ?, ?, NULL, ?, ?)
  `).bind(
    id,
    ip_hash,
    reason,
    expires_at,
    now,
    a.user?.id || null
  ).run();

  return json(200, "ok", {
    saved: true,
    id,
    expires_at
  });
}

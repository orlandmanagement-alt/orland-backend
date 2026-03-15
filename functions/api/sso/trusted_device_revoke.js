import {
  json,
  readJson,
  requireAuth,
  nowSec,
  sha256Base64,
  auditEvent
} from "../../_lib.js";

function getClientIp(request){
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

function getUa(request){
  return request.headers.get("user-agent") || "";
}

async function sha(v){
  return await sha256Base64(String(v || ""));
}

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const started = Date.now();
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  const body = await readJson(request) || {};
  const deviceId = String(body.device_id || "").trim();

  if(!deviceId){
    return json(400, "invalid_input", { message: "device_id_required" });
  }

  const found = await env.DB.prepare(`
    SELECT id, user_id, status
    FROM sso_trusted_devices
    WHERE id = ?
      AND user_id = ?
    LIMIT 1
  `).bind(deviceId, auth.uid).first();

  if(!found){
    return json(404, "not_found", { message: "device_not_found" });
  }

  await env.DB.prepare(`
    UPDATE sso_trusted_devices
    SET
      status = 'revoked',
      updated_at = ?
    WHERE id = ?
  `).bind(nowSec(), deviceId).run();

  const ip = getClientIp(request);
  const ua = getUa(request);
  const ipHash = await hashIp(env, ip);
  const uaHash = await sha(ua);

  await auditEvent(env, request, {
    actor_user_id: auth.uid,
    action: "sso_trusted_device_revoke",
    ip_hash: ipHash,
    ua_hash: uaHash,
    http_status: 200,
    duration_ms: Date.now() - started,
    meta: {
      device_id: deviceId,
      previous_status: found.status || null
    }
  });

  return json(200, "ok", {
    revoked: true,
    device_id: deviceId
  });
}

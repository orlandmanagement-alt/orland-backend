import { json, readJson, requireAuth, hasRole, sha256Base64, auditEvent } from "../../_lib.js";

function getClientIp(request){
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip||"") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const ipHash = await hashIp(env, getClientIp(request));
  const uaHash = await sha256Base64(request.headers.get("user-agent") || "");

  await auditEvent(env, request, {
    actor_user_id: a.uid,
    action: "session_anomaly",
    ip_hash: ipHash,
    ua_hash: uaHash,
    http_status: 200,
    meta: {
      kind: String(body.kind || "manual"),
      note: String(body.note || "")
    }
  });

  return json(200,"ok",{ recorded:true });
}

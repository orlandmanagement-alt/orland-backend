import { json, cookie, requireAuth, revokeSessionBySid, auditEvent, sha256Base64 } from "../_lib.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok){
    const res = json(200, "ok", { logged_out: true });
    res.headers.append("set-cookie", cookie("sid", "", { maxAge: 0 }));
    return res;
  }

  let ipHash = null;
  try{
    const ip = request.headers.get("CF-Connecting-IP") || "";
    ipHash = await hashIp(env, ip);
  }catch{}

  try{
    await revokeSessionBySid(env, a.sid, "logout");
  }catch{}

  try{
    await auditEvent(env, request, {
      actor_user_id: a.uid,
      action: "logout",
      ip_hash: ipHash,
      http_status: 200,
      meta: { sid: a.sid || null }
    });
  }catch{}

  const res = json(200, "ok", { logged_out: true });
  res.headers.append("set-cookie", cookie("sid", "", { maxAge: 0 }));
  return res;
}

export async function onRequestGet(ctx){
  return onRequestPost(ctx);
}

import { json, readJson, requireAuth, hasRole, nowSec, normEmail, sha256Base64 } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const email = normEmail(body.email);
  const role = String(body.role||"talent").trim();
  const ttl_hours = Math.min(168, Math.max(1, Number(body.ttl_hours||24)));

  if(!email.includes("@")) return json(400,"invalid_input",{message:"email"});
  if(role !== "talent") return json(400,"invalid_input",{message:"role_must_be_talent"});

  const now = nowSec();
  const expires_at = now + (ttl_hours*3600);
  const id = crypto.randomUUID();
  const email_hash = await sha256Base64(email + "|" + (env.HASH_PEPPER||""));

  // token to give to user (simple): invite id
  await env.DB.prepare(`
    INSERT INTO invites (id,email_hash,role,expires_at,used_at,used_by_user_id,created_by_user_id,created_at,tenant_id)
    VALUES (?,?,?,?,NULL,NULL,?,?,NULL)
  `).bind(id, email_hash, role, expires_at, a.uid, now).run();

  return json(200,"ok",{ invite_id:id, token:id, expires_at });
}

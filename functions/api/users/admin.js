import { json, readJson, requireAuth, hasRole, nowSec, normEmail, randomB64, pbkdf2Hash, sha256Base64 } from "../../_lib.js";

async function ensureRole(env, name){
  let r = await env.DB.prepare("SELECT id FROM roles WHERE name=? LIMIT 1").bind(name).first();
  if(r) return r.id;
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO roles (id,name,created_at) VALUES (?,?,?)").bind(id,name,nowSec()).run();
  return id;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q")||"").trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));
  const like = q ? `%${q}%` : null;

  const r = await env.DB.prepare(`
    SELECT u.id,u.email_norm,u.display_name,u.status,u.created_at,u.updated_at,
           GROUP_CONCAT(ro.name) AS roles,
           (SELECT MAX(created_at) FROM sessions s WHERE s.user_id=u.id) AS last_login_at
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id=u.id
    LEFT JOIN roles ro ON ro.id=ur.role_id
    WHERE ( ? IS NULL OR u.email_norm LIKE ? OR u.display_name LIKE ? )
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT ?
  `).bind(like, like, like, limit).all();

  // keep only admin/staff/super_admin in this endpoint
  const users = (r.results||[]).map(x=>({
    id:x.id,
    email_norm:x.email_norm,
    display_name:x.display_name,
    status:x.status,
    roles: String(x.roles||"").split(",").filter(Boolean),
    last_login_at: x.last_login_at || null,
    created_at:x.created_at,
    updated_at:x.updated_at
  })).filter(u=>{
    const s = new Set(u.roles);
    return s.has("super_admin") || s.has("admin") || s.has("staff");
  });

  return json(200,"ok",{ users });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const email = normEmail(body.email);
  const display_name = String(body.display_name||"").trim();
  const role = String(body.role||"staff").trim();
  const password = String(body.password||"");

  if(!email.includes("@") || password.length<10) return json(400,"invalid_input",{message:"email/password"});
  if(!["staff","admin","super_admin"].includes(role)) return json(400,"invalid_input",{message:"role"});

  // admin cannot create super_admin
  if(role === "super_admin" && !hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",{message:"need_super_admin"});

  const used = await env.DB.prepare("SELECT 1 AS ok FROM users WHERE email_norm=? LIMIT 1").bind(email).first();
  if(used) return json(409,"conflict",{message:"email_used"});

  const now = nowSec();
  const user_id = crypto.randomUUID();

  const salt = randomB64(16);
  const iter = 100000;
  const hash = await pbkdf2Hash(password, salt, iter);

  let email_hash = "";
  try{
    email_hash = await sha256Base64(email + "|" + (env.HASH_PEPPER||""));
  }catch{
    email_hash = email;
  }

  await env.DB.prepare(`
    INSERT INTO users (id,email_norm,email_hash,display_name,status,created_at,updated_at,password_hash,password_salt,password_iter,password_algo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(user_id,email,email_hash,display_name||email,"active",now,now,hash,salt,iter,"pbkdf2_sha256").run();

  const role_id = await ensureRole(env, role);
  await env.DB.prepare("INSERT INTO user_roles (user_id,role_id,created_at) VALUES (?,?,?)").bind(user_id,role_id,now).run();

  return json(200,"ok",{ created:true, user_id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action||"");
  const user_id = String(body.user_id||"");
  if(!user_id) return json(400,"invalid_input",null);

  const now = nowSec();

  if(action === "disable" || action === "enable"){
    const status = action === "disable" ? "disabled" : "active";
    await env.DB.prepare("UPDATE users SET status=?, updated_at=? WHERE id=?").bind(status, now, user_id).run();
    return json(200,"ok",{ updated:true });
  }

  if(action === "reset_password"){
    const new_password = String(body.new_password||"");
    if(new_password.length < 10) return json(400,"invalid_input",{message:"min_10"});

    const salt = randomB64(16);
    const iter = 100000;
    const hash = await pbkdf2Hash(new_password, salt, iter);

    await env.DB.prepare(`
      UPDATE users
      SET password_hash=?, password_salt=?, password_iter=?, password_algo=?, updated_at=?
      WHERE id=?
    `).bind(hash, salt, iter, "pbkdf2_sha256", now, user_id).run();

    return json(200,"ok",{ updated:true });
  }

  if(action === "revoke_sessions"){
    await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(now, user_id).run();
    return json(200,"ok",{ revoked:true });
  }

  
  if (action === "unlock") {
    const email = normEmail(body?.email);
    if(!email.includes("@")) return json(400,"invalid_input",{message:"email"});
    const u = await env.DB.prepare("SELECT id FROM users WHERE email_norm=? LIMIT 1").bind(email).first();
    if(!u) return json(404,"not_found",null);

    await env.DB.prepare("UPDATE users SET pw_fail_count=0, pw_fail_last_at=NULL, locked_until=NULL, lock_reason=NULL, updated_at=? WHERE id=?")
      .bind(now, u.id).run();

    return json(200,"ok",{ unlocked:true, user_id: u.id });
  }

  return json(400, "invalid_input", { message:"unknown_action" });

}

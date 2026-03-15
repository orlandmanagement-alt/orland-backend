import { json, readJson, requireAuth, hasRole, nowSec, normEmail, randomB64, pbkdf2Hash, sha256Base64 } from "../../_lib.js";

async function ensureRole(env, name){
  let r = await env.DB.prepare("SELECT id FROM roles WHERE name=? LIMIT 1").bind(name).first();
  if(r) return r.id;
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO roles (id,name,created_at) VALUES (?,?,?)").bind(id, name, nowSec()).run();
  return id;
}

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403, "forbidden", null);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const like = q ? "%" + q + "%" : null;

  const r = await env.DB.prepare(`
    SELECT u.id, u.email_norm, u.display_name, u.status, u.created_at, u.updated_at,
           (SELECT MAX(created_at) FROM sessions s WHERE s.user_id=u.id) AS last_login_at
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles ro ON ro.id=ur.role_id
    WHERE ro.name='talent'
      AND (? IS NULL OR u.email_norm LIKE ? OR u.display_name LIKE ?)
    ORDER BY u.created_at DESC
  `).bind(like, like, like).all();

  return json(200, "ok", { users: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const email = normEmail(body.email);
  const display_name = String(body.display_name || "").trim();
  const password = String(body.password || "");
  const status = String(body.status || "active").trim();

  if(!email.includes("@")) return json(400, "invalid_input", { message: "invalid_email" });
  if(password.length < 10) return json(400, "invalid_input", { message: "password_min_10" });
  if(!["active","disabled"].includes(status)) return json(400, "invalid_input", { message: "invalid_status" });

  const used = await env.DB.prepare("SELECT 1 AS ok FROM users WHERE email_norm=? LIMIT 1").bind(email).first();
  if(used) return json(409, "conflict", { message: "email_used" });

  const now = nowSec();
  const user_id = crypto.randomUUID();
  const salt = randomB64(16);
  const iter = 100000;
  const hash = await pbkdf2Hash(password, salt, iter);

  let email_hash = "";
  try{
    email_hash = await sha256Base64(email + "|" + (env.HASH_PEPPER || ""));
  }catch{
    email_hash = email;
  }

  await env.DB.prepare(`
    INSERT INTO users (
      id,email_norm,email_hash,display_name,status,created_at,updated_at,
      password_hash,password_salt,password_iter,password_algo
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    user_id, email, email_hash, display_name || email, status, now, now,
    hash, salt, iter, "pbkdf2_sha256"
  ).run();

  const role_id = await ensureRole(env, "talent");
  await env.DB.prepare("INSERT OR IGNORE INTO user_roles (user_id,role_id,created_at) VALUES (?,?,?)").bind(user_id, role_id, now).run();

  return json(200, "ok", { created: true, user_id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const action = String(body.action || "");
  const user_id = String(body.user_id || "");
  const now = nowSec();

  if(!user_id) return json(400, "invalid_input", { message: "user_id" });

  if(action === "disable" || action === "enable"){
    const status = action === "disable" ? "disabled" : "active";
    await env.DB.prepare("UPDATE users SET status=?, updated_at=? WHERE id=?").bind(status, now, user_id).run();
    return json(200, "ok", { updated: true });
  }

  if(action === "update_profile"){
    const display_name = String(body.display_name || "").trim();
    if(!display_name) return json(400, "invalid_input", { message: "display_name" });
    await env.DB.prepare("UPDATE users SET display_name=?, updated_at=? WHERE id=?").bind(display_name, now, user_id).run();
    return json(200, "ok", { updated: true });
  }

  if(action === "reset_password"){
    const new_password = String(body.new_password || "");
    if(new_password.length < 10) return json(400, "invalid_input", { message: "password_min_10" });
    const salt = randomB64(16);
    const iter = 100000;
    const hash = await pbkdf2Hash(new_password, salt, iter);
    await env.DB.prepare(`
      UPDATE users
      SET password_hash=?, password_salt=?, password_iter=?, password_algo=?, updated_at=?
      WHERE id=?
    `).bind(hash, salt, iter, "pbkdf2_sha256", now, user_id).run();
    return json(200, "ok", { updated: true });
  }

  return json(400, "invalid_input", { message: "unknown_action" });
}

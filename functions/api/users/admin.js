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
           GROUP_CONCAT(r.name) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id=u.id
    LEFT JOIN roles r ON r.id=ur.role_id
    WHERE ( ? IS NULL OR u.email_norm LIKE ? OR u.display_name LIKE ? )
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT ?
  `).bind(like, like, like, limit).all();

  const users = (r.results||[]).map(x=>({
    id:x.id,
    email_norm:x.email_norm,
    display_name:x.display_name,
    status:x.status,
    roles: String(x.roles||"").split(",").filter(Boolean),
    created_at:x.created_at,
    updated_at:x.updated_at
  }));

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

  const used = await env.DB.prepare("SELECT 1 AS ok FROM users WHERE email_norm=? LIMIT 1").bind(email).first();
  if(used) return json(409,"conflict",{message:"email_used"});

  const now = nowSec();
  const user_id = crypto.randomUUID();

  // password
  const salt = randomB64(16);
  const iter = 100000; // aman untuk Pages
  const hash = await pbkdf2Hash(password, salt, iter);

  // email_hash (optional)
  let email_hash = "";
  try{
    email_hash = await sha256Base64(email + "|" + (env.HASH_PEPPER||""));
  }catch{}

  await env.DB.prepare(`
    INSERT INTO users (id,email_norm,email_hash,display_name,status,created_at,updated_at,password_hash,password_salt,password_iter,password_algo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(user_id,email,email_hash,display_name||email,"active",now,now,hash,salt,iter,"pbkdf2_sha256").run();

  const role_id = await ensureRole(env, role);
  await env.DB.prepare("INSERT INTO user_roles (user_id,role_id,created_at) VALUES (?,?,?)").bind(user_id,role_id,now).run();

  return json(200,"ok",{ created:true, user_id });
}

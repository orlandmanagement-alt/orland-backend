import {
  json,
  readJson,
  normEmail,
  nowSec,
  sha256Base64,
  pbkdf2Hash
} from "../../_lib.js";

function randomB64(bytes=16){
  const u8 = crypto.getRandomValues(new Uint8Array(bytes));
  let s="";
  for(const c of u8) s+=String.fromCharCode(c);
  return btoa(s);
}

export async function onRequestPost({request,env}){

  const BOOT_SECRET = String(env.BOOTSTRAP_SECRET || "");
  if(!BOOT_SECRET){
    return json(500,"server_error",{message:"BOOTSTRAP_SECRET_not_configured"});
  }

  const body = await readJson(request) || {};
  const display_name = String(body.display_name || "").trim();
  const email = normEmail(body.email);
  const password = String(body.password || "");
  const bootstrap_secret = String(body.bootstrap_secret || "");

  if(bootstrap_secret !== BOOT_SECRET){
    return json(403,"forbidden",{message:"invalid_bootstrap_secret"});
  }

  if(!display_name || !email.includes("@") || password.length < 8){
    return json(400,"invalid_input",null);
  }

  const exists = await env.DB.prepare(`
    SELECT id FROM users LIMIT 1
  `).first();

  if(exists){
    return json(400,"setup_locked",{message:"super_admin_already_exists"});
  }

  const now = nowSec();
  const id = crypto.randomUUID();

  const salt = randomB64(16);
  const iter = 100000;
  const hash = await pbkdf2Hash(password,salt,iter);
  const email_hash = await sha256Base64(email);

  await env.DB.prepare(`
    INSERT INTO users(
      id,email_norm,email_hash,display_name,status,
      created_at,updated_at,
      password_hash,password_salt,password_iter,password_algo,
      email_verified,email_verified_at,
      profile_completed,
      session_version
    )
    VALUES(?,?,?,?,?,
           ?,?,
           ?,?,?,?,
           ?,?,
           ?,?)
  `).bind(
    id,email,email_hash,display_name,"active",
    now,now,
    hash,salt,iter,"pbkdf2_sha256",
    1,now,
    1,
    1
  ).run();

  await env.DB.prepare(`
    INSERT INTO user_roles(user_id,role_id,created_at)
    VALUES(?,?,?)
  `).bind(id,"super_admin",now).run();

  return json(200,"ok",{
    created:true,
    user:{
      id,
      email,
      display_name,
      role:"super_admin"
    }
  });
}

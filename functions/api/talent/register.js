import { json, readJson, nowSec, normEmail, randomB64, pbkdf2Hash, sha256Base64 } from "../../_lib.js";

// public endpoint (no session): invite token required
export async function onRequestPost({ request, env }){
  const body = await readJson(request) || {};
  const token = String(body.token||"").trim();
  const email = normEmail(body.email);
  const password = String(body.password||"");
  const display_name = String(body.display_name||"").trim() || "Talent";

  if(!token) return json(400,"invalid_input",{message:"missing_token"});
  if(!email.includes("@") || password.length < 10) return json(400,"invalid_input",{message:"email/password"});

  const now = nowSec();

  // check invite
  const email_hash = await sha256Base64(email + "|" + (env.HASH_PEPPER||""));
  const inv = await env.DB.prepare(`
    SELECT id,role,expires_at,used_at
    FROM invites
    WHERE id=? AND email_hash=? AND role='talent'
    LIMIT 1
  `).bind(token, email_hash).first();

  if(!inv) return json(403,"forbidden",{message:"invite_invalid"});
  if(inv.used_at) return json(409,"conflict",{message:"invite_used"});
  if(now > Number(inv.expires_at||0)) return json(403,"forbidden",{message:"invite_expired"});

  // ensure not already used email
  const used = await env.DB.prepare("SELECT id FROM users WHERE email_norm=? LIMIT 1").bind(email).first();
  if(used) return json(409,"conflict",{message:"email_used"});

  // ensure role exists
  let r = await env.DB.prepare("SELECT id FROM roles WHERE name='talent' LIMIT 1").first();
  if(!r){
    const rid = "role_talent";
    await env.DB.prepare("INSERT OR IGNORE INTO roles (id,name,created_at) VALUES (?,?,?)").bind(rid,"talent",now).run();
    r = { id: rid };
  }

  const user_id = crypto.randomUUID();
  const salt = randomB64(16);
  const iter = 100000;
  const hash = await pbkdf2Hash(password, salt, iter);

  await env.DB.prepare(`
    INSERT INTO users (
      id,email_norm,email_hash,display_name,status,created_at,updated_at,
      password_hash,password_salt,password_iter,password_algo
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    user_id, email, email_hash, display_name, "active", now, now,
    hash, salt, iter, "pbkdf2_sha256"
  ).run();

  await env.DB.prepare("INSERT INTO user_roles (user_id,role_id,created_at) VALUES (?,?,?)")
    .bind(user_id, r.id, now).run();

  // mark invite used
  await env.DB.prepare("UPDATE invites SET used_at=?, used_by_user_id=? WHERE id=? AND used_at IS NULL")
    .bind(now, user_id, token).run();

  // ensure talent_profiles row exists (minimal)
  const chk = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='talent_profiles' LIMIT 1").first();
  if(chk){
    await env.DB.prepare(`
      INSERT OR IGNORE INTO talent_profiles (
        user_id,name,gender,dob,age_years,location,location_norm,height_cm,category_csv,
        score,progress_pct,verified_email,verified_phone,verified_identity,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      user_id, display_name, null, null, null, null, null, null, "",
      0,0,0,0,0, now, now
    ).run();
  }

  return json(200,"ok",{ created:true, user_id });
}

import { json, readJson, pbkdf2Hash, timingSafeEqual, normEmail, getRolesForUser, createSession, requireEnv, cookie, sha256Base64, nowSec, hasRole, audit } from "../_lib.js";

async function loadPolicy(env){
  const def = { lock_enabled:1, lock_threshold:5, lock_minutes:15, lock_scope:"email", super_admin_exempt:1 };
  try{
    const row = await env.DB.prepare("SELECT v FROM system_settings WHERE k='security_policy_json' LIMIT 1").first();
    if(row?.v){
      const cfg = JSON.parse(row.v);
      return { ...def, ...(cfg||{}) };
    }
  }catch{}
  return def;
}

function getClientIp(req){
  return req.headers.get("cf-connecting-ip")
    || (req.headers.get("x-forwarded-for")||"").split(",")[0].trim()
    || "";
}

async function isLocked(env, k){
  if(!env.KV) return false;
  const v = await env.KV.get(k);
  return !!v;
}

async function addFail(env, key, ttlSec){
  if(!env.KV) return 0;
  const k = `fail:${key}`;
  const cur = Number(await env.KV.get(k) || "0") + 1;
  await env.KV.put(k, String(cur), { expirationTtl: ttlSec });
  return cur;
}

async function setLock(env, key, minutes){
  if(!env.KV) return;
  const k = `lock:${key}`;
  await env.KV.put(k, "1", { expirationTtl: Math.max(60, minutes*60) });
}

async function getSecurityPolicy(env){
  try{
    const row = await env.DB.prepare("SELECT * FROM security_policy WHERE id='sec_global' LIMIT 1").first();
    return row || { pw_fail_window_sec:900, pw_fail_max:5, lock_sec:900 };
  }catch{
    return { pw_fail_window_sec:900, pw_fail_max:5, lock_sec:900 };
  }
}

function isSuperAdmin(roles){
  return Array.isArray(roles) && roles.includes("super_admin");
}

export async function onRequestPost({ request, env }) {
  const miss = requireEnv(env, ["HASH_PEPPER"]);
  if (miss.length) return json(500, "server_error", { message: "missing_env", missing: miss });

  const policy = await loadPolicy(env);

  const body = await readJson(request);
  const email = normEmail(body?.email);
  const password = String(body?.password || "");

  if (!email.includes("@") || password.length < 6) return json(400, "invalid_input", null);

  const pepper = env.HASH_PEPPER || "";
  const email_key = await sha256Base64(`${email}|${pepper}`);

  const ip = getClientIp(request);
  const ip_key = ip ? await sha256Base64(`${ip}|${pepper}`) : "noip";

  // Lock check (email or email+ip)
  if(policy.lock_enabled && env.KV){
    const lockKey = policy.lock_scope === "email+ip" ? `${email_key}:${ip_key}` : `${email_key}`;
    const locked = await isLocked(env, `lock:${lockKey}`);
    if(locked){
      return json(403, "forbidden", { message:"account_locked" });
    }
  }

  const u = await env.DB.prepare(
    "SELECT id,email_norm,display_name,status,password_hash,password_salt,password_iter,locked_until,lock_reason,pw_fail_count,pw_fail_last_at
  FROM users WHERE email_norm=? LIMIT 1"
  ).bind(email).first();

  // if user not found -> still count fail (avoid enumeration)
  if (!u) {
    if(policy.lock_enabled){
      const n = await addFail(env, email_key, 15*60);
      if(n >= policy.lock_threshold){
        const lk = policy.lock_scope === "email+ip" ? `${email_key}:${ip_key}` : `${email_key}`;
        await setLock(env, lk, policy.lock_minutes);
      }
    }
    return json(403, "user_belum_terdaftar", null);
  }

  if (String(u.status) !== "active") return json(403, "forbidden", null);
  if (!u.password_hash || !u.password_salt) return json(403, "password_invalid", { message: "password_not_set" });

  const iter = Math.min(100000, Number(u.password_iter || env.PBKDF2_ITER || 100000));
  const calc = await pbkdf2Hash(password, u.password_salt, iter);

  if (!timingSafeEqual(calc, u.password_hash)) {
    // roles check to exempt super_admin from lockout if configured
    let roles = [];
    try{ roles = await getRolesForUser(env, u.id); }catch{}
    const isSA = roles.includes("super_admin");

    if(policy.lock_enabled && !(policy.super_admin_exempt && isSA)){
      const lockKey = policy.lock_scope === "email+ip" ? `${email_key}:${ip_key}` : `${email_key}`;
      const n = await addFail(env, lockKey, 15*60);
      if(n >= policy.lock_threshold){
        await setLock(env, lockKey, policy.lock_minutes);
      }
    }
    return json(403, "password_invalid", null);
  }

  // success: clear fail counters (best-effort)
  try{
    if(env.KV){
      const lockKey = policy.lock_scope === "email+ip" ? `${email_key}:${ip_key}` : `${email_key}`;
      await env.KV.delete(`fail:${lockKey}`);
      await env.KV.delete(`fail:${email_key}`);
    }
  }catch{}

  const roles = await getRolesForUser(env, u.id);

  
  // super_admin bypass: clear lock counters so they don't get stuck
  if (isSuperAdmin(roles)) {
    try{
      await env.DB.prepare("UPDATE users SET pw_fail_count=0, pw_fail_last_at=NULL, locked_until=NULL, lock_reason=NULL WHERE id=?")
        .bind(u.id).run();
    }catch{}
  }
// Dashboard ini untuk admin/staff/super_admin
  const allowed = roles.includes("super_admin") || roles.includes("admin") || roles.includes("staff");
  if (!allowed) return json(403, "forbidden", { message: "role_not_allowed_for_dashboard" });

  const sess = await createSession(env, u.id, roles);
  const res = json(200, "ok", { id: u.id, email_norm: u.email_norm, display_name: u.display_name, roles, exp: sess.exp });
  res.headers.append("set-cookie", cookie("sid", sess.sid || sess.token || "", { maxAge: sess.ttl }));
    try{
    await audit(env,{actor_user_id:u.id,action:"auth.login.ok",route:"POST /api/login",http_status:200,meta:{roles}});
  }catch{}
  return res;
}

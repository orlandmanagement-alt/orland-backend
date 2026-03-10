import {
  json, readJson, cookie,
  pbkdf2Hash, timingSafeEqual,
  normEmail, getRolesForUser,
  createSession, requireEnv,
  nowSec, sha256Base64, auditEvent
} from "../_lib.js";

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

async function getCounter(env, key){
  return await env.DB.prepare(`
    SELECT k,count,window_start,updated_at
    FROM request_counters
    WHERE k=?
    LIMIT 1
  `).bind(key).first();
}

async function setCounter(env, key, count, window_start){
  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO request_counters (k,count,window_start,updated_at)
    VALUES (?,?,?,?)
    ON CONFLICT(k) DO UPDATE SET
      count=excluded.count,
      window_start=excluded.window_start,
      updated_at=excluded.updated_at
  `).bind(key, count, window_start, now).run();
}

async function delCounter(env, key){
  await env.DB.prepare(`DELETE FROM request_counters WHERE k=?`).bind(key).run();
}

async function bumpFailCounter(env, ipHash, windowSec, maxFail){
  const key = "login_fail:" + ipHash;
  const now = nowSec();
  const row = await getCounter(env, key);

  let count = 1;
  let window_start = now;

  if(row){
    const ws = Number(row.window_start || now);
    const cnt = Number(row.count || 0);
    if(now - ws <= windowSec){
      count = cnt + 1;
      window_start = ws;
    }
  }

  await setCounter(env, key, count, window_start);
  return { count, window_start, blocked: count >= maxFail };
}

async function resetFailCounter(env, ipHash){
  await delCounter(env, "login_fail:" + ipHash);
}

async function autoBlockIp(env, actor_user_id, ipHash, ttlSec, reason){
  const now = nowSec();
  const expires_at = now + ttlSec;
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO ip_blocks (id, ip_hash, reason, created_at, expires_at, revoked_at, actor_user_id)
    VALUES (?,?,?,?,?,?,?)
  `).bind(id, ipHash, reason, now, expires_at, null, actor_user_id || null).run();

  return { id, expires_at };
}

export async function onRequestPost({ request, env }) {
  const started = Date.now();

  const miss = requireEnv(env, ["HASH_PEPPER"]);
  if (miss.length) return json(500, "server_error", { message: "missing_env", missing: miss });

  const body = await readJson(request) || {};
  const email = normEmail(body.email);
  const password = String(body.password || "");

  const ip = getClientIp(request);
  const ua = getUa(request);
  const ipHash = await hashIp(env, ip);
  const uaHash = await sha(ua);
  const actorIdentifierHash = email ? await sha(email) : null;

  const FAIL_WINDOW_SEC = Number(env.LOGIN_FAIL_WINDOW_SEC || 900);
  const FAIL_MAX = Number(env.LOGIN_FAIL_MAX || 8);
  const BLOCK_TTL_SEC = Number(env.LOGIN_FAIL_BLOCK_TTL_SEC || 3600);

  if (!email.includes("@") || password.length < 6) {
    const res = await bumpFailCounter(env, ipHash, FAIL_WINDOW_SEC, FAIL_MAX);
    await auditEvent(env, request, {
      actor_identifier_hash: actorIdentifierHash,
      action: "password_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 400,
      duration_ms: Date.now() - started,
      meta: { reason: "invalid_input", count: res.count }
    });
    if(res.blocked){
      await autoBlockIp(env, null, ipHash, BLOCK_TTL_SEC, "auto_login_fail");
      await auditEvent(env, request, {
        action: "lockout",
        actor_identifier_hash: actorIdentifierHash,
        ip_hash: ipHash,
        ua_hash: uaHash,
        http_status: 403,
        duration_ms: Date.now() - started,
        meta: { reason: "too_many_failed_attempts" }
      });
      return json(403, "blocked_ip", { message: "too_many_failed_attempts" });
    }
    return json(400, "invalid_input", null);
  }

  const u = await env.DB.prepare(
    "SELECT id,email_norm,display_name,status,password_hash,password_salt,password_iter FROM users WHERE email_norm=? LIMIT 1"
  ).bind(email).first();

  if (!u){
    const res = await bumpFailCounter(env, ipHash, FAIL_WINDOW_SEC, FAIL_MAX);
    await auditEvent(env, request, {
      actor_identifier_hash: actorIdentifierHash,
      action: "password_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 403,
      duration_ms: Date.now() - started,
      meta: { reason: "user_not_found", count: res.count }
    });
    if(res.blocked){
      await autoBlockIp(env, null, ipHash, BLOCK_TTL_SEC, "auto_login_fail");
      await auditEvent(env, request, {
        action: "lockout",
        actor_identifier_hash: actorIdentifierHash,
        ip_hash: ipHash,
        ua_hash: uaHash,
        http_status: 403,
        duration_ms: Date.now() - started,
        meta: { reason: "too_many_failed_attempts" }
      });
      return json(403, "blocked_ip", { message: "too_many_failed_attempts" });
    }
    return json(403, "user_belum_terdaftar", null);
  }

  if (String(u.status) !== "active") {
    await auditEvent(env, request, {
      actor_user_id: u.id,
      actor_identifier_hash: actorIdentifierHash,
      action: "lockout",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 403,
      duration_ms: Date.now() - started,
      meta: { reason: "user_inactive" }
    });
    return json(403, "forbidden", null);
  }

  if (!u.password_hash || !u.password_salt) {
    return json(403, "password_invalid", { message: "password_not_set" });
  }

  const iter = Math.min(100000, Number(u.password_iter || env.PBKDF2_ITER || 100000));
  const calc = await pbkdf2Hash(password, u.password_salt, iter);

  if (!timingSafeEqual(calc, u.password_hash)) {
    const res = await bumpFailCounter(env, ipHash, FAIL_WINDOW_SEC, FAIL_MAX);
    await auditEvent(env, request, {
      actor_user_id: u.id,
      actor_identifier_hash: actorIdentifierHash,
      action: "password_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 403,
      duration_ms: Date.now() - started,
      meta: { reason: "wrong_password", count: res.count, blocked: res.blocked }
    });
    if(res.blocked){
      await autoBlockIp(env, u.id, ipHash, BLOCK_TTL_SEC, "auto_login_fail");
      await auditEvent(env, request, {
        actor_user_id: u.id,
        actor_identifier_hash: actorIdentifierHash,
        action: "lockout",
        ip_hash: ipHash,
        ua_hash: uaHash,
        http_status: 403,
        duration_ms: Date.now() - started,
        meta: { reason: "too_many_failed_attempts" }
      });
      return json(403, "blocked_ip", { message: "too_many_failed_attempts" });
    }
    return json(403, "password_invalid", null);
  }

  const roles = await getRolesForUser(env, u.id);
  const allowed = roles.includes("super_admin") || roles.includes("admin") || roles.includes("staff");
  if (!allowed) {
    await auditEvent(env, request, {
      actor_user_id: u.id,
      actor_identifier_hash: actorIdentifierHash,
      action: "lockout",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 403,
      duration_ms: Date.now() - started,
      meta: { reason: "role_not_allowed_for_dashboard" }
    });
    return json(403, "forbidden", { message: "role_not_allowed_for_dashboard" });
  }

  await resetFailCounter(env, ipHash);

  const sess = await createSession(env, u.id, roles);
  const res = json(200, "ok", {
    id: u.id,
    email_norm: u.email_norm,
    display_name: u.display_name,
    roles,
    exp: sess.exp
  });
  res.headers.append("set-cookie", cookie("sid", sess.sid, { maxAge: sess.ttl }));
  return res;
}

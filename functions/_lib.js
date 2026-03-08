/**
 * Orland Dashboard — Pages Functions shared lib (FINAL, SID cookie)
 * - Cookie "sid" stores ONLY session UUID (short, stable).
 * - Session validity is checked in D1 sessions table.
 * - PBKDF2 SHA-256 (cap iterations <= 100000 for CF Pages runtime compatibility)
 */

export function nowSec(){ return Math.floor(Date.now()/1000); }

export function json(status, st, data){
  return new Response(JSON.stringify({ status: st, data }, null, 0), {
    status,
    headers: {
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
    }
  });
}

export async function readJson(request){
  try{
    const ct = request.headers.get("content-type") || "";
    if(!ct.includes("application/json")) return null;
    return await request.json();
  }catch{ return null; }
}

export function normEmail(email){
  return String(email||"").trim().toLowerCase();
}

export function timingSafeEqual(a,b){
  a = String(a||""); b = String(b||"");
  if(a.length !== b.length) return false;
  let r=0;
  for(let i=0;i<a.length;i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r===0;
}

export function randomB64(bytes=18){
  const u8 = crypto.getRandomValues(new Uint8Array(bytes));
  let s=""; for(const c of u8) s += String.fromCharCode(c);
  return btoa(s);
}

export async function sha256Base64(str){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(str)));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * PBKDF2 limit: beberapa runtime Pages/Workers membatasi iter <= 100000
 */
export async function pbkdf2Hash(password, saltB64, iterations){
  const iter = Math.min(100000, Math.max(1000, Number(iterations||100000)));
  const salt = Uint8Array.from(atob(String(saltB64)), c => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name:"PBKDF2", hash:"SHA-256", salt, iterations: iter },
    baseKey,
    256
  );
  const u8 = new Uint8Array(bits);
  return btoa(String.fromCharCode(...u8));
}

export function cookie(name, value, opt={}){
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opt.path || "/"}`);
  if(opt.maxAge != null) parts.push(`Max-Age=${Math.floor(opt.maxAge)}`);
  if(opt.httpOnly !== false) parts.push("HttpOnly");
  parts.push("Secure");
  parts.push(`SameSite=${opt.sameSite || "Lax"}`);
  return parts.join("; ");
}

export function parseCookies(request){
  const h = request.headers.get("cookie") || "";
  const out = {};
  h.split(";").map(s=>s.trim()).filter(Boolean).forEach(kv=>{
    const i = kv.indexOf("=");
    if(i>0) out[kv.slice(0,i)] = kv.slice(i+1);
  });
  return out;
}

export function requireEnv(env, keys){
  const miss = [];
  for(const k of keys) if(!env[k]) miss.push(k);
  return miss;
}

export function hasRole(roles, allowed){
  const s = new Set((roles||[]).map(String));
  return allowed.some(r=>s.has(r));
}

export async function getRolesForUser(env, user_id){
  const r = await env.DB.prepare(`
    SELECT r.name AS name
    FROM user_roles ur
    JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=?
  `).bind(user_id).all();
  return (r.results||[]).map(x=>x.name);
}

let MENUS_HAS_ICON = null;
export async function menusHasIcon(env){
  if(MENUS_HAS_ICON !== null) return MENUS_HAS_ICON;
  try{
    const r = await env.DB.prepare(`PRAGMA table_info('menus')`).all();
    MENUS_HAS_ICON = (r.results||[]).some(x=>String(x.name)==="icon");
  }catch{
    MENUS_HAS_ICON = false;
  }
  return MENUS_HAS_ICON;
}

export async function audit(env, { actor_user_id, action, route, http_status, meta }){
  try{
    const id = crypto.randomUUID();
    const created_at = nowSec();
    const meta_json = JSON.stringify({
      route: route || null,
      http_status: http_status || null,
      ...(meta||{})
    });
    await env.DB.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, meta_json, created_at)
      VALUES (?,?,?,?,?,?,?)
    `).bind(id, actor_user_id||null, String(action||"event"), "http", route||null, meta_json, created_at).run();
  }catch{
    // never block
  }
}

/**
 * Sessions (SID cookie):
 * - Cookie "sid" = sessions.id (UUID)
 * - sessions.token_hash is set to sid (kept for schema compatibility)
 */
export async function createSession(env, user_id, roles){
  const now = nowSec();

  const r = (roles||[]);
  let ttlMin = Number(env.SESSION_TTL_MIN_STAFF || 240);
  if (r.includes("super_admin")) ttlMin = Number(env.SESSION_TTL_MIN_SUPER_ADMIN || 60);
  if (r.includes("admin")) ttlMin = Number(env.SESSION_TTL_MIN_ADMIN || 120);

  const ttl = Math.max(10, ttlMin) * 60;
  const exp = now + ttl;
  const sid = crypto.randomUUID();

  // token_hash disimpan sebagai sid agar simple (cookie SID)
  const token_hash = sid;

  await env.DB.prepare(`
    INSERT INTO sessions (
      id,user_id,token_hash,created_at,expires_at,revoked_at,
      ip_hash,ua_hash,role_snapshot,ip_prefix_hash,last_seen_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    sid, user_id, token_hash, now, exp, null,
    null, null, JSON.stringify(r), null, now
  ).run();

  return { sid, exp, ttl };
}

export async function revokeSessionBySid(env, sid){
  try{
    await env.DB.prepare(`UPDATE sessions SET revoked_at=? WHERE id=?`).bind(nowSec(), sid).run();
  }catch{}
}

export async function requireAuth(env, request){
  const cookies = parseCookies(request);
  const sid = cookies.sid || "";
  if(!sid) return { ok:false, res: json(401,"unauthorized",null) };

  const now = nowSec();
  const row = await env.DB.prepare(`
    SELECT id,user_id,role_snapshot,expires_at,revoked_at
    FROM sessions
    WHERE id=?
    LIMIT 1
  `).bind(sid).first();

  if(!row || row.revoked_at || now > Number(row.expires_at||0)){
    return { ok:false, res: json(401,"unauthorized",null) };
  }

  try{
    await env.DB.prepare(`UPDATE sessions SET last_seen_at=? WHERE id=?`).bind(now, row.id).run();
  }catch{}

  let roles = [];
  try{ roles = JSON.parse(row.role_snapshot || "[]") || []; }catch{ roles=[]; }

  return { ok:true, uid: row.user_id, roles, token: sid };
}


// =========================
// Security helpers (rate limit, ip/ua hash, lock policy)
// =========================

export function getClientIp(request){
  // Cloudflare standard headers
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

export function ipPrefix(ip){
  // IPv4: keep /24 prefix, IPv6: keep first 4 hextets (rough /64)
  ip = String(ip || "").trim();
  if (!ip) return "";
  if (ip.includes(".")){
    const p = ip.split(".");
    if (p.length >= 3) return `${p[0]}.${p[1]}.${p[2]}.0/24`;
    return ip;
  }
  if (ip.includes(":")){
    const parts = ip.split(":").filter(Boolean);
    return parts.slice(0, 4).join(":") + "::/64";
  }
  return ip;
}

export async function hashIpPrefix(env, request){
  const ip = getClientIp(request);
  const pref = ipPrefix(ip);
  if (!pref) return "";
  const pepper = env.HASH_PEPPER || "";
  return await sha256Base64(`${pref}|${pepper}`);
}

export async function hashUa(env, request){
  const ua = request.headers.get("user-agent") || "";
  if (!ua) return "";
  const pepper = env.HASH_PEPPER || "";
  return await sha256Base64(`${ua}|${pepper}`);
}

/**
 * Simple KV rate limiter (fixed window)
 * key: rl:<name>:<bucket>
 */
export async function rateLimitKV(env, name, limit, windowSec){
  if (!env.KV) return { ok: true, left: null }; // if no KV binding, don't block
  const now = nowSec();
  const bucket = Math.floor(now / windowSec);
  const key = `rl:${name}:${bucket}`;

  const raw = await env.KV.get(key);
  const cur = raw ? Number(raw) : 0;

  if (cur >= limit) return { ok: false, left: 0 };

  // increment
  const next = cur + 1;
  // keep TTL slightly longer than window
  await env.KV.put(key, String(next), { expirationTtl: windowSec + 5 });

  return { ok: true, left: Math.max(0, limit - next) };
}

/**
 * Account lock policy (non-super_admin):
 * - maxFail within window => lock for lockSec
 */
export async function applyLoginFailPolicy(env, user_id, now, opt){
  const maxFail = opt.maxFail ?? 5;
  const windowSec = opt.windowSec ?? 15 * 60;
  const lockSec = opt.lockSec ?? 15 * 60;

  const u = await env.DB.prepare(
    "SELECT pw_fail_count, pw_fail_last_at, locked_until FROM users WHERE id=? LIMIT 1"
  ).bind(user_id).first();

  const last = Number(u?.pw_fail_last_at || 0);
  const within = (now - last) <= windowSec;

  const nextCount = within ? (Number(u?.pw_fail_count || 0) + 1) : 1;
  const lockUntil = nextCount >= maxFail ? (now + lockSec) : null;

  await env.DB.prepare(
    "UPDATE users SET pw_fail_count=?, pw_fail_last_at=?, locked_until=?, lock_reason=?, updated_at=? WHERE id=?"
  ).bind(
    nextCount,
    now,
    lockUntil,
    lockUntil ? "too_many_password_fail" : null,
    now,
    user_id
  ).run();

  return { nextCount, locked_until: lockUntil };
}

export async function clearLoginFailPolicy(env, user_id, now){
  await env.DB.prepare(
    "UPDATE users SET pw_fail_count=0, pw_fail_last_at=NULL, locked_until=NULL, lock_reason=NULL, updated_at=? WHERE id=?"
  ).bind(now, user_id).run();
}
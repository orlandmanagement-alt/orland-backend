/**
 * Orland Core Lib (D1 + Pages Functions)
 * - SID cookie session (cookie "sid" = sessions.id UUID)
 * - PBKDF2 SHA-256 (cap iter <= 100000 for Pages runtime)
 */

export function nowSec(){ return Math.floor(Date.now()/1000); }

export function json(status, st, data){
  return new Response(JSON.stringify({ status: st, data }, null, 0), {
    status,
    headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
  });
}

export function js(status, body){
  return new Response(body, {
    status,
    headers: { "content-type":"application/javascript; charset=utf-8", "cache-control":"no-store" }
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
  let r=0; for(let i=0;i<a.length;i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
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

export async function pbkdf2Hash(password, saltB64, iterations){
  const iter = Math.min(100000, Math.max(1000, Number(iterations||100000)));
  const salt = Uint8Array.from(atob(String(saltB64)), c => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt, iterations: iter }, baseKey, 256);
  const u8 = new Uint8Array(bits);
  return btoa(String.fromCharCode(...u8));
}

export function cookie(name, value, opt={}){
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opt.path || "/"}`);
  if(opt.maxAge != null) parts.push(`Max-Age=${Math.floor(opt.maxAge)}`);
  parts.push("HttpOnly");
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

export async function ensurePluginSchema(env){
  // plugins table
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'inactive',
      manifest_json TEXT NOT NULL DEFAULT '{}',
      config_json TEXT NOT NULL DEFAULT '{}',
      installed_at INTEGER,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS plugin_routes (
      plugin_id TEXT NOT NULL,
      path TEXT NOT NULL,
      module_url TEXT NOT NULL,
      export_name TEXT,
      title TEXT,
      sort_order INTEGER NOT NULL DEFAULT 100,
      PRIMARY KEY (plugin_id, path)
    )
  `).run();
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

export async function createSession(env, user_id, roles){
  const now = nowSec();
  const r = (roles||[]);
  let ttlMin = Number(env.SESSION_TTL_MIN_STAFF || 240);
  if (r.includes("super_admin")) ttlMin = Number(env.SESSION_TTL_MIN_SUPER_ADMIN || 60);
  if (r.includes("admin")) ttlMin = Number(env.SESSION_TTL_MIN_ADMIN || 120);
  const ttl = Math.max(10, ttlMin) * 60;
  const exp = now + ttl;
  const sid = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO sessions (id,user_id,token_hash,created_at,expires_at,revoked_at,roles_json,last_seen_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    sid, user_id, sid, now, exp, null, JSON.stringify(r), now
  ).run();

  return { sid, exp, ttl };
}

export async function revokeSessionBySid(env, sid){
  try{ await env.DB.prepare(`UPDATE sessions SET revoked_at=? WHERE id=?`).bind(nowSec(), sid).run(); }catch{}
}

export async function requireAuth(env, request){
  const cookies = parseCookies(request);
  const sid = cookies.sid || "";
  if(!sid) return { ok:false, res: json(401,"unauthorized",null) };

  const now = nowSec();
  const row = await env.DB.prepare(`
    SELECT id,user_id,expires_at,revoked_at,roles_json
    FROM sessions
    WHERE id=?
    LIMIT 1
  `).bind(sid).first();

  if(!row || row.revoked_at || now > Number(row.expires_at||0)){
    return { ok:false, res: json(401,"unauthorized",null) };
  }

  try{ await env.DB.prepare(`UPDATE sessions SET last_seen_at=? WHERE id=?`).bind(now, row.id).run(); }catch{}
  const roles = JSON.parse(row.roles_json||"[]") || [];
  return { ok:true, uid: row.user_id, roles, token: sid };
}

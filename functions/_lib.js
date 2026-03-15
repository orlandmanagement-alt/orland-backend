/**
 * Orland Dashboard — shared lib (SSO STABLE MODE)
 * Fokus:
 * - JSON helpers
 * - password hash
 * - session SID cookie
 * - auth check
 * - dashboard + talent + client SSO
 * - tanpa lock / rate-limit enforcement
 */

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function json(status, st, data) {
  return new Response(JSON.stringify({ status: st, data }, null, 0), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function readJson(request) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return await request.json();
  } catch {
    return null;
  }
}

export function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function timingSafeEqual(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (a.length !== b.length) return false;

  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return r === 0;
}

export function randomB64(bytes = 18) {
  const u8 = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const c of u8) s += String.fromCharCode(c);
  return btoa(s);
}

export async function sha256Base64(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(str))
  );
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function pbkdf2Hash(password, saltB64, iterations) {
  const iter = Math.min(100000, Math.max(1000, Number(iterations || 100000)));
  const salt = Uint8Array.from(atob(String(saltB64)), c => c.charCodeAt(0));

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iter },
    baseKey,
    256
  );

  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export function cookie(name, value, opt = {}) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opt.path || "/"}`);

  if (opt.domain) parts.push(`Domain=${opt.domain}`);
  if (opt.maxAge != null) parts.push(`Max-Age=${Math.floor(opt.maxAge)}`);
  if (opt.httpOnly !== false) parts.push("HttpOnly");
  if (opt.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${opt.sameSite || "Lax"}`);

  return parts.join("; ");
}

export function parseCookies(request) {
  const h = request.headers.get("cookie") || "";
  const out = {};

  h.split(";")
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(kv => {
      const i = kv.indexOf("=");
      if (i > 0) out[kv.slice(0, i)] = kv.slice(i + 1);
    });

  return out;
}

export function requireEnv(env, keys) {
  const miss = [];
  for (const k of keys) {
    if (!env[k]) miss.push(k);
  }
  return miss;
}

export function hasRole(roles, allowed) {
  const s = new Set((roles || []).map(String));
  return allowed.some(r => s.has(r));
}

export async function getRolesForUser(env, user_id) {
  try {
    const r = await env.DB.prepare(`
      SELECT r.name AS name
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `).bind(user_id).all();

    return (r.results || []).map(x => x.name);
  } catch {
    return [];
  }
}

let MENUS_HAS_ICON = null;
export async function menusHasIcon(env) {
  if (MENUS_HAS_ICON !== null) return MENUS_HAS_ICON;

  try {
    const r = await env.DB.prepare(`PRAGMA table_info('menus')`).all();
    MENUS_HAS_ICON = (r.results || []).some(x => String(x.name) === "icon");
  } catch {
    MENUS_HAS_ICON = false;
  }

  return MENUS_HAS_ICON;
}

export async function audit(env, { actor_user_id, action, route, http_status, meta }) {
  try {
    const id = crypto.randomUUID();
    const created_at = nowSec();
    const meta_json = JSON.stringify({
      route: route || null,
      http_status: http_status || null,
      ...(meta || {})
    });

    await env.DB.prepare(`
      INSERT INTO audit_logs (
        id, actor_user_id, action, target_type, target_id, meta_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      actor_user_id || null,
      String(action || "event"),
      "http",
      route || null,
      meta_json,
      created_at
    ).run();
  } catch {
    // best-effort only
  }
}

function toNum(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/**
 * Session mode:
 * - cookie "sid" = sessions.id
 * - minimal, stabil, shared lintas subdomain
 */
export async function createSession(env, user_id, roles) {
  const now = nowSec();
  const r = Array.isArray(roles) ? roles : [];

  const ttlMin = toNum(env.SESSION_TTL_MIN, 720); // default 12 jam
  const ttl = Math.max(10, ttlMin) * 60;
  const exp = now + ttl;
  const sid = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO sessions (
      id, user_id, token_hash, created_at, expires_at, revoked_at,
      ip_hash, ua_hash, role_snapshot, ip_prefix_hash, last_seen_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sid,
    user_id,
    sid,
    now,
    exp,
    null,
    null,
    null,
    JSON.stringify(r),
    null,
    now
  ).run();

  return { sid, exp, ttl };
}

export async function revokeSessionBySid(env, sid) {
  try {
    await env.DB.prepare(`
      UPDATE sessions
      SET revoked_at = ?
      WHERE id = ?
    `).bind(nowSec(), sid).run();
  } catch {}
}

export async function requireAuth(env, request) {
  const cookies = parseCookies(request);
  const sid = String(cookies.sid || "").trim();

  if (!sid) {
    return { ok: false, res: json(401, "unauthorized", null) };
  }

  let row = null;
  try {
    row = await env.DB.prepare(`
      SELECT id, user_id, role_snapshot, expires_at, revoked_at
      FROM sessions
      WHERE id = ?
      LIMIT 1
    `).bind(sid).first();
  } catch {
    return { ok: false, res: json(401, "unauthorized", null) };
  }

  if (!row) {
    return { ok: false, res: json(401, "unauthorized", null) };
  }

  if (row.revoked_at) {
    return { ok: false, res: json(401, "unauthorized", null) };
  }

  const exp = Number(row.expires_at || 0);
  if (!Number.isFinite(exp) || nowSec() > exp) {
    return { ok: false, res: json(401, "unauthorized", null) };
  }

  try {
    await env.DB.prepare(`
      UPDATE sessions
      SET last_seen_at = ?
      WHERE id = ?
    `).bind(nowSec(), row.id).run();
  } catch {}

  let roles = [];
  try {
    roles = JSON.parse(row.role_snapshot || "[]") || [];
  } catch {
    roles = [];
  }

  return {
    ok: true,
    uid: row.user_id,
    roles,
    token: sid
  };
}

/* =========================================================
   Portal helpers
   ========================================================= */

export function portalAccessFromRoles(roles) {
  const r = new Set((roles || []).map(x => String(x)));

  return {
    dashboard: r.has("super_admin") || r.has("admin") || r.has("staff"),
    talent: r.has("super_admin") || r.has("admin") || r.has("staff") || r.has("talent"),
    client: r.has("super_admin") || r.has("admin") || r.has("staff") || r.has("client")
  };
}

export function canAccessPortal(roles, portal) {
  const p = portalAccessFromRoles(roles);
  return !!p[String(portal || "")];
}

export function defaultPortalFromRoles(roles) {
  const p = portalAccessFromRoles(roles);
  if (p.dashboard) return "dashboard";
  if (p.talent) return "talent";
  if (p.client) return "client";
  return null;
}

export function portalBaseUrl(env, portal) {
  if (portal === "dashboard") return env.DASHBOARD_URL || "https://dashboard.orlandmanagement.com";
  if (portal === "talent") return env.TALENT_URL || "https://talent.orlandmanagement.com";
  if (portal === "client") return env.CLIENT_URL || "https://client.orlandmanagement.com";
  return env.DASHBOARD_URL || "https://dashboard.orlandmanagement.com";
}

export function safeNextPath(nextPath, fallback = "/") {
  const s = String(nextPath || "").trim();
  if (!s.startsWith("/") || s.startsWith("//")) return fallback;
  return s;
}

export function portalRedirectUrl(env, portal, nextPath = "/") {
  return `${portalBaseUrl(env, portal)}${safeNextPath(nextPath, "/")}`;
}

export function inferCookieDomain(request, env) {
  if (env.COOKIE_DOMAIN) return env.COOKIE_DOMAIN;

  try {
    const host = new URL(request.url).hostname;
    if (host === "orlandmanagement.com" || host.endsWith(".orlandmanagement.com")) {
      return ".orlandmanagement.com";
    }
  } catch {}

  return undefined;
}

export async function requirePortalAuth(env, request, portal) {
  const a = await requireAuth(env, request);
  if (!a.ok) return a;

  if (!canAccessPortal(a.roles, portal)) {
    return {
      ok: false,
      res: json(403, "forbidden", {
        message: "role_not_allowed_for_portal",
        portal
      })
    };
  }

  return a;
}

/* =========================================================
   Compat helpers: sengaja longgar agar tidak memblok login
   ========================================================= */

export function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

export function ipPrefix(ip) {
  ip = String(ip || "").trim();
  if (!ip) return "";

  if (ip.includes(".")) {
    const p = ip.split(".");
    if (p.length >= 3) return `${p[0]}.${p[1]}.${p[2]}.0/24`;
  }

  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.slice(0, 4).join(":") + "::/64";
  }

  return ip;
}

export async function hashIpPrefix(env, request) {
  try {
    const ip = getClientIp(request);
    const pref = ipPrefix(ip);
    if (!pref) return "";
    const pepper = env.HASH_PEPPER || "";
    return await sha256Base64(`${pref}|${pepper}`);
  } catch {
    return "";
  }
}

export async function hashUa(env, request) {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (!ua) return "";
    const pepper = env.HASH_PEPPER || "";
    return await sha256Base64(`${ua}|${pepper}`);
  } catch {
    return "";
  }
}

// nonaktif sementara
export async function rateLimitKV(env, name, limit, windowSec) {
  return { ok: true, left: null };
}

// nonaktif sementara
export async function applyLoginFailPolicy(env, user_id, now, opt) {
  return { nextCount: 0, locked_until: null };
}

// nonaktif sementara
export async function clearLoginFailPolicy(env, user_id, now) {
  return true;
}

import { json, nowSec, sha256Base64 } from "./_lib.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip||"") + "|" + pepper);
}

function getClientIp(request){
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

async function isBlocked(env, ip){
  if(!ip) return false;
  const ip_hash = await hashIp(env, ip);
  const now = nowSec();

  const row = await env.DB.prepare(`
    SELECT id
    FROM ip_blocks
    WHERE ip_hash=?
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
    LIMIT 1
  `).bind(ip_hash, now).first();

  return !!row;
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const p = url.pathname || "/";

  // only protect API routes
  if (!p.startsWith("/api/")) return ctx.next();

  // allow login/logout/me if you want softer behavior
  // comment these 3 lines if you want ALL /api/* blocked
  if (p === "/api/login" || p === "/api/logout") return ctx.next();

  try{
    const ip = getClientIp(request);
    const blocked = await isBlocked(env, ip);
    if(blocked){
      return json(403, "blocked_ip", { message:"ip_blocked" });
    }
  }catch(e){
    // fail-open: jangan matikan seluruh API kalau D1/error sesaat
    // kalau mau fail-closed, ganti return json(503,...)
  }

  return ctx.next();
}

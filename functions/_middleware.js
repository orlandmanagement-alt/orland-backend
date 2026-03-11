import { json, nowSec, sha256Base64, auditEvent } from "./_lib.js";

const POLICY_KEY = "security_policy";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

async function hashUa(request){
  return await sha256Base64(request.headers.get("user-agent") || "");
}

function getClientIp(request){
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

async function readSecurityPolicy(env){
  const fallback = {
    rate_limit: {
      enabled: 1,
      window_sec: Number(env.API_RATE_WINDOW_SEC || 60),
      max_requests: Number(env.API_RATE_MAX || 60)
    },
    headers: {
      enabled: 1
    }
  };

  try{
    const row = await env.DB.prepare(`
      SELECT v
      FROM system_settings
      WHERE k = ?
      LIMIT 1
    `).bind(POLICY_KEY).first();

    if(!row?.v) return fallback;

    const parsed = JSON.parse(row.v || "{}");
    return {
      rate_limit: {
        enabled: parsed?.rate_limit?.enabled ? 1 : 0,
        window_sec: Math.max(1, Number(parsed?.rate_limit?.window_sec || fallback.rate_limit.window_sec)),
        max_requests: Math.max(1, Number(parsed?.rate_limit?.max_requests || fallback.rate_limit.max_requests))
      },
      headers: {
        enabled: parsed?.headers?.enabled ? 1 : 0
      }
    };
  }catch{
    return fallback;
  }
}

async function isBlocked(env, ip){
  if(!ip) return false;
  const ip_hash = await hashIp(env, ip);
  const now = nowSec();

  const row = await env.DB.prepare(`
    SELECT id
    FROM ip_blocks
    WHERE ip_hash = ?
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
    LIMIT 1
  `).bind(ip_hash, now).first();

  return !!row;
}

async function bumpCounter(env, key, windowSec){
  const now = nowSec();
  const row = await env.DB.prepare(`
    SELECT k, count, window_start
    FROM request_counters
    WHERE k = ?
    LIMIT 1
  `).bind(key).first();

  let count = 1;
  let window_start = now;

  if(row){
    const ws = Number(row.window_start || now);
    const cnt = Number(row.count || 0);
    if((now - ws) <= windowSec){
      count = cnt + 1;
      window_start = ws;
    }
  }

  await env.DB.prepare(`
    INSERT INTO request_counters (k, count, window_start, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      count = excluded.count,
      window_start = excluded.window_start,
      updated_at = excluded.updated_at
  `).bind(key, count, window_start, now).run();

  return { count, window_start };
}

function applySecurityHeaders(response, enabled){
  if(!enabled || !response) return response;

  const h = new Headers(response.headers);
  h.set("Cache-Control", "no-store");
  h.set("Pragma", "no-cache");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "same-origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: h
  });
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const p = url.pathname || "/";

  if(!p.startsWith("/api/")) return ctx.next();

  const ip = getClientIp(request);
  const ipHash = await hashIp(env, ip);
  const uaHash = await hashUa(request);
  const policy = await readSecurityPolicy(env);

  try{
    const blocked = await isBlocked(env, ip);
    if(blocked){
      await auditEvent(env, request, {
        action: "blocked_ip",
        ip_hash: ipHash,
        ua_hash: uaHash,
        http_status: 403,
        meta: { reason: "ip_blocked" }
      });
      return applySecurityHeaders(
        json(403, "blocked_ip", { message: "ip_blocked" }),
        !!policy?.headers?.enabled
      );
    }
  }catch{}

  try{
    const sensitive = (
      p === "/api/login" ||
      p.startsWith("/api/security") ||
      p.startsWith("/api/config") ||
      p.startsWith("/api/ipblocks")
    );

    if(sensitive && policy?.rate_limit?.enabled){
      const rlWindow = Number(policy.rate_limit.window_sec || 60);
      const rlMax = Number(policy.rate_limit.max_requests || 60);
      const c = await bumpCounter(env, "rl:" + p + ":" + ipHash, rlWindow);

      if(c.count > rlMax){
        await auditEvent(env, request, {
          action: "rate_limited",
          ip_hash: ipHash,
          ua_hash: uaHash,
          http_status: 429,
          meta: { path: p, count: c.count, window_sec: rlWindow, max: rlMax }
        });

        return applySecurityHeaders(
          json(429, "rate_limited", { message: "too_many_requests" }),
          !!policy?.headers?.enabled
        );
      }
    }
  }catch{}

  const res = await ctx.next();
  return applySecurityHeaders(res, !!policy?.headers?.enabled);
}

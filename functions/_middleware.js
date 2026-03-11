import { json, nowSec, sha256Base64, auditEvent, requireAuth } from "./_lib.js";
import { getEffectiveVerificationState, shouldEnforceForPath } from "./api/config/_global_policy.js";

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip||"") + "|" + pepper);
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

async function bumpCounter(env, key, windowSec){
  const now = nowSec();
  const row = await env.DB.prepare(`
    SELECT k,count,window_start
    FROM request_counters
    WHERE k=?
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
    INSERT INTO request_counters (k,count,window_start,updated_at)
    VALUES (?,?,?,?)
    ON CONFLICT(k) DO UPDATE SET
      count=excluded.count,
      window_start=excluded.window_start,
      updated_at=excluded.updated_at
  `).bind(key, count, window_start, now).run();

  return { count, window_start };
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const p = url.pathname || "/";

  if (!p.startsWith("/api/")) return ctx.next();

  const ip = getClientIp(request);
  const ipHash = await hashIp(env, ip);
  const uaHash = await hashUa(request);

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
      return json(403, "blocked_ip", { message:"ip_blocked" });
    }
  }catch{}

  try{
    const sensitive = (
      p === "/api/login" ||
      p.startsWith("/api/security") ||
      p.startsWith("/api/config") ||
      p.startsWith("/api/ip-blocks")
    );

    if(sensitive){
      const rlWindow = Number(env.API_RATE_WINDOW_SEC || 60);
      const rlMax = Number(env.API_RATE_MAX || 60);
      const c = await bumpCounter(env, "rl:" + p + ":" + ipHash, rlWindow);

      if(c.count > rlMax){
        await auditEvent(env, request, {
          action: "rate_limited",
          ip_hash: ipHash,
          ua_hash: uaHash,
          http_status: 429,
          meta: { path: p, count: c.count, window_sec: rlWindow, max: rlMax }
        });
        return json(429, "rate_limited", { message:"too_many_requests" });
      }
    }
  }catch{}

  try{
    const a = await requireAuth(env, request);
    if(a.ok && shouldEnforceForPath(p)){
      const state = await getEffectiveVerificationState(env, a.user, a.roles || []);

      if(!state.compliance.compliant){
        await auditEvent(env, request, {
          action: "verification_policy_block",
          user_id: a.user?.id || null,
          ip_hash: ipHash,
          ua_hash: uaHash,
          http_status: 403,
          meta: {
            path: p,
            scope: state.compliance.scope,
            required_actions: state.compliance.required_actions
          }
        });

        return json(403, "verification_required", {
          message: "global_verification_policy_not_satisfied",
          scope: state.compliance.scope,
          required_actions: state.compliance.required_actions,
          checks: state.compliance.checks
        });
      }
    }
  }catch{}

  const res = await ctx.next();

  try{
    const a = await requireAuth(env, request);
    if(a.ok){
      const state = await getEffectiveVerificationState(env, a.user, a.roles || []);
      res.headers.set("x-verification-scope", String(state.compliance.scope || "admin"));
      res.headers.set("x-verification-compliant", state.compliance.compliant ? "1" : "0");
      res.headers.set("x-verification-required-actions", (state.compliance.required_actions || []).join(","));
    }
  }catch{}

  return res;
}

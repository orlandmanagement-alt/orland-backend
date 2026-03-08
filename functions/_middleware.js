import { requireAuth, sha256Base64, nowSec } from "./_lib.js";

function hdr(req, k){ return req.headers.get(k) || ""; }

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const t0 = Date.now();

  // actor (best-effort)
  let actor_user_id = null;
  let roles = [];
  try {
    const a = await requireAuth(env, request);
    if (a.ok) { actor_user_id = a.uid; roles = a.roles || []; }
  } catch {}

  const res = await ctx.next();

  // security headers for ALL routes
  const h = new Headers(res.headers);
  h.set("cache-control","no-store");
  h.set("x-content-type-options","nosniff");
  h.set("referrer-policy","strict-origin-when-cross-origin");
  h.set("x-frame-options","DENY");
  h.set("permissions-policy","camera=(), microphone=(), geolocation=()");

  // CSP only for HTML (allow common CDNs you use)
  if (!url.pathname.startsWith("/api/")) {
    h.set("content-security-policy",
      "default-src 'self' https:; " +
      "script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com 'unsafe-inline'; " +
      "style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; " +
      "connect-src 'self' https:; " +
      "frame-ancestors 'none';"
    );
  }

  // AUDIT only API routes (best effort)
  if (url.pathname.startsWith("/api/")) {
    try{
      const now = nowSec();
      const duration_ms = Date.now() - t0;

      const ip = hdr(request,"cf-connecting-ip") || hdr(request,"x-forwarded-for").split(",")[0].trim();
      const ua = hdr(request,"user-agent");
      const ip_hash = ip ? await sha256Base64(ip + "|" + (env.HASH_PEPPER||"")) : null;
      const ua_hash = ua ? await sha256Base64(ua + "|" + (env.HASH_PEPPER||"")) : null;

      const route = `${request.method} ${url.pathname}`;
      const action = "http.request";

      const meta_json = JSON.stringify({
        query: Object.fromEntries(url.searchParams.entries()),
        roles: roles || []
      });

      // schema kamu sudah ada: route,http_status,duration_ms,ip_hash,ua_hash
      await env.DB.prepare(`
        INSERT INTO audit_logs
          (id, actor_user_id, action, route, http_status, duration_ms, ip_hash, ua_hash, meta_json, created_at)
        VALUES
          (?,?,?,?,?,?,?,?,?,?)
      `).bind(
        crypto.randomUUID(),
        actor_user_id,
        action,
        route,
        res.status,
        duration_ms,
        ip_hash,
        ua_hash,
        meta_json,
        now
      ).run();
    }catch{
      // never block
    }
  }

  return new Response(res.body, { status: res.status, headers: h });
}

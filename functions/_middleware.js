import { requireAuth, sha256Base64, nowSec } from "./_lib.js";

function hdr(req, k){ return req.headers.get(k) || ""; }

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const t0 = Date.now();

  let actor_user_id = null;
  let roles = [];

  try {
    const a = await requireAuth(env, request);
    if (a.ok) {
      actor_user_id = a.uid;
      roles = a.roles || [];
    }
  } catch {}

  const res = await ctx.next();

  // clone response while preserving original headers/cookies
  const out = new Response(res.body, res);

  out.headers.set("cache-control", "no-store");
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  out.headers.set("x-frame-options", "DENY");
  out.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");

  if (!url.pathname.startsWith("/api/")) {
    out.headers.set(
      "content-security-policy",
      "default-src 'self' https:; " +
      "script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com 'unsafe-inline'; " +
      "style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; " +
      "connect-src 'self' https:; " +
      "frame-ancestors 'none';"
    );
  }

  if (url.pathname.startsWith("/api/")) {
    try {
      const now = nowSec();
      const duration_ms = Date.now() - t0;

      const ip = hdr(request, "cf-connecting-ip") || hdr(request, "x-forwarded-for").split(",")[0].trim();
      const ua = hdr(request, "user-agent");
      const ip_hash = ip ? await sha256Base64(ip + "|" + (env.HASH_PEPPER || "")) : null;
      const ua_hash = ua ? await sha256Base64(ua + "|" + (env.HASH_PEPPER || "")) : null;

      const route = `${request.method} ${url.pathname}`;
      const action = "http.request";

      const meta_json = JSON.stringify({
        query: Object.fromEntries(url.searchParams.entries()),
        roles: roles || []
      });

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
        out.status,
        duration_ms,
        ip_hash,
        ua_hash,
        meta_json,
        now
      ).run();
    } catch {}
  }

  return out;
}

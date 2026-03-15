/**
 * Middleware minimal:
 * - preserve Set-Cookie
 * - tambah header dasar
 * - CSP untuk non-API
 * - tanpa audit / auth logic tambahan
 */

export async function onRequest(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);

  const res = await ctx.next();

  // preserve Set-Cookie
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

  return out;
}

export function hardenHeaders(res){
  const h = new Headers(res.headers);

  // Basic hardening
  h.set("cache-control","no-store");
  h.set("x-content-type-options","nosniff");
  h.set("referrer-policy","strict-origin-when-cross-origin");
  h.set("x-frame-options","DENY");

  // CSP: keep API safe (no scripts), UI CSP should be on Pages headers config if needed.
  // For API JSON, safest is restrict everything.
  if ((h.get("content-type")||"").includes("application/json")) {
    h.set("content-security-policy","default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  }

  return new Response(res.body, { status: res.status, headers: h });
}

export async function onRequest(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);

  // Only touch API
  if (!url.pathname.startsWith("/api/")) return ctx.next();

  const res = await ctx.next();
  const h = new Headers(res.headers);
  h.set("cache-control","no-store");
  h.set("x-content-type-options","nosniff");
  return new Response(res.body, { status: res.status, headers: h });
}

export async function onRequest(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);

  // hanya set headers untuk /api
  if (!url.pathname.startsWith("/api/")) return await ctx.next();

  try {
    const res = await ctx.next();
    const h = new Headers(res.headers);
    h.set("cache-control","no-store");
    h.set("x-content-type-options","nosniff");
    return new Response(res.body, { status: res.status, headers: h });
  } catch (e) {
    console.error("MIDDLEWARE_CRASH", e);
    return new Response(JSON.stringify({ status:"server_error", data:{ message: String(e?.message || e) } }), {
      status: 500,
      headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
    });
  }
}

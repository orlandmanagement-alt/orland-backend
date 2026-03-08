import { json, requireAuth, hasRole, nowSec } from "../../../_lib.js";

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["talent"])) return json(403,"forbidden",{ message:"talent_only" });

  if(!env.R2) return json(500,"server_error",{ message:"missing_R2_binding" });

  const url = new URL(request.url);
  const key = String(url.searchParams.get("key")||"").trim();
  if(!key.startsWith(`talent/${a.uid}/`)) return json(400,"invalid_input",{ message:"bad_key" });

  const ct = request.headers.get("content-type") || "application/octet-stream";
  const buf = await request.arrayBuffer();

  await env.R2.put(key, buf, {
    httpMetadata: { contentType: ct },
    customMetadata: { uploaded_by: a.uid, uploaded_at: String(nowSec()) }
  });

  return json(200,"ok",{ stored:true, object_key:key, bytes: buf.byteLength });
}

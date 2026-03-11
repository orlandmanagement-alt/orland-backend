import { json } from "../../../_lib.js";
import { requireConfigAccess, readBody } from "../_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireConfigAccess(env, request, true);
  if(!a.ok) return a.res;

  const body = await readBody(request);
  const id = String(body.id || "").trim();
  if(!id){
    return json(400, "invalid_input", { message:"id_required" });
  }

  await env.DB.prepare(`
    UPDATE plugins
    SET enabled=0,
        updated_at=?
    WHERE id=?
  `).bind(Math.floor(Date.now() / 1000), id).run();

  return json(200, "ok", {
    saved: true,
    id
  });
}

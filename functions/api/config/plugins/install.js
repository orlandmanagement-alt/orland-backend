import { json } from "../../../_lib.js";
import { requireConfigAccess, readBody } from "../_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireConfigAccess(env, request, true);
  if(!a.ok) return a.res;

  const body = await readBody(request);
  const id = String(body.id || "").trim();
  const name = String(body.name || "").trim();
  const version = String(body.version || "").trim();

  if(!id || !name){
    return json(400, "invalid_input", { message:"id_or_name_required" });
  }

  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    INSERT INTO plugins (id, name, version, enabled, installed_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      version=excluded.version,
      enabled=1,
      updated_at=excluded.updated_at
  `).bind(id, name, version, now, now).run();

  return json(200, "ok", {
    saved: true,
    id
  });
}

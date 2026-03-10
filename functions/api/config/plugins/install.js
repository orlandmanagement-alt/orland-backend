import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id || "").trim();
  const name = String(body.name || id).trim();

  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO plugins (id, name, version, enabled, installed_at, updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      enabled=1,
      updated_at=excluded.updated_at
  `).bind(id, name || id, "", 1, now, now).run();

  return json(200,"ok",{ installed:true, id });
}

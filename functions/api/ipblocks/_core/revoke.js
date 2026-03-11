import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function s(v){ return String(v || "").trim(); }

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const id = s(body.id);
  if(!id) return json(400, "invalid_input", { message:"id_required" });

  const ex = await env.DB.prepare(`
    SELECT id, revoked_at
    FROM ip_blocks
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!ex) return json(404, "not_found", { message:"ip_block_not_found" });
  if(Number(ex.revoked_at || 0) > 0){
    return json(200, "ok", { revoked:true, id, already:true });
  }

  await env.DB.prepare(`
    UPDATE ip_blocks
    SET revoked_at=?
    WHERE id=?
  `).bind(nowSec(), id).run();

  return json(200, "ok", {
    revoked: true,
    id
  });
}

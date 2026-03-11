import { json, readJson, requireAuth, hasRole } from "../../_lib.js";

function norm(v){
  return String(v || "").trim();
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const id = norm(body.id);
  const exclude_id = norm(body.exclude_id);

  if(!id){
    return json(400, "invalid_input", { message: "id_required", available: false });
  }

  const row = await env.DB.prepare(`
    SELECT id
    FROM menus
    WHERE id=?
      AND (?='' OR id<>?)
    LIMIT 1
  `).bind(id, exclude_id, exclude_id).first();

  const available = !row;

  return json(200, "ok", {
    available,
    message: available ? "available" : "already_used"
  });
}

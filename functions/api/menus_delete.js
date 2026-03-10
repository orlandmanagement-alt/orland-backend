import { json, requireAuth, hasRole, readJson } from "../_lib.js";

function s(v){
  return String(v || "").trim();
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const id = s(body.id);

  if(!id){
    return json(400, "invalid_input", {
      error: "id_required"
    });
  }

  const menu = await env.DB.prepare(`
    SELECT id, code, label
    FROM menus
    WHERE id = ?
  `).bind(id).first();

  if(!menu){
    return json(404, "not_found", {
      error: "menu_not_found"
    });
  }

  const child = await env.DB.prepare(`
    SELECT id, label
    FROM menus
    WHERE parent_id = ?
    ORDER BY sort_order ASC, created_at ASC
    LIMIT 1
  `).bind(id).first();

  if(child){
    return json(409, "invalid_input", {
      error: "menu_has_children",
      child
    });
  }

  await env.DB.prepare(`
    DELETE FROM role_menus
    WHERE menu_id = ?
  `).bind(id).run();

  await env.DB.prepare(`
    DELETE FROM menus
    WHERE id = ?
  `).bind(id).run();

  return json(200, "ok", {
    deleted: {
      id: menu.id,
      code: menu.code,
      label: menu.label
    }
  });
}

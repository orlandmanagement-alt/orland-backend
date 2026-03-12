import { json, readJson, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const items = Array.isArray(body.items) ? body.items : [];

  if(!items.length){
    return json(400, "invalid_input", { message:"items_required" });
  }

  for(const item of items){
    const id = String(item?.id || "").trim();
    const parent_id = item?.parent_id ? String(item.parent_id).trim() : null;
    const sort_order = Number(item?.sort_order ?? 9999);

    if(!id){
      return json(400, "invalid_input", { message:"item_id_required" });
    }

    await env.DB.prepare(`
      UPDATE menus
      SET parent_id = ?, sort_order = ?
      WHERE id = ?
    `).bind(parent_id, sort_order, id).run();
  }

  return json(200, "ok", {
    saved: true,
    count: items.length
  });
}

import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

/**
 * POST /api/menus/reorder
 * body: { items: [{id, sort_order}] }
 * super_admin/admin only
 */
export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const items = Array.isArray(body.items) ? body.items : [];
  if(!items.length) return json(400,"invalid_input",{ message:"items_required" });

  const now = nowSec();

  const stmts = [];
  for(const it of items){
    const id = String(it.id||"").trim();
    const sort_order = Number(it.sort_order||0);
    if(!id || !Number.isFinite(sort_order)) continue;
    stmts.push(env.DB.prepare("UPDATE menus SET sort_order=? WHERE id=?").bind(sort_order, id));
  }

  // D1 batch
  if(stmts.length){
    await env.DB.batch(stmts);
  }

  return json(200,"ok",{ updated: stmts.length, now });
}

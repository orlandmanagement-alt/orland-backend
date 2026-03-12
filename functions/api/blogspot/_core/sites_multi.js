import { json, readJson, nowSec } from "../../../_lib.js";
import { requireSiteAccess, listSites, setSiteContext } from "./site_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireSiteAccess(env, request, true);
  if(!a.ok) return a.res;

  return json(200, "ok", {
    items: await listSites(env)
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireSiteAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const action = String(body.action || "create").trim().toLowerCase();
  const id = String(body.id || "").trim();

  if(!["create","update","delete","set_active"].includes(action)){
    return json(400, "invalid_input", { error:"invalid_action" });
  }

  if(action === "set_active"){
    if(!id) return json(400, "invalid_input", { error:"id_required" });
    await setSiteContext(env, "active_site_id", id);
    return json(200, "ok", { active_site_id: id });
  }

  if(action === "delete"){
    if(!id) return json(400, "invalid_input", { error:"id_required" });
    await env.DB.prepare(`DELETE FROM blogspot_sites WHERE id=?`).bind(id).run();
    return json(200, "ok", { deleted:true, id });
  }

  const blog_id = String(body.blog_id || "").trim();
  const blog_name = String(body.blog_name || "").trim();
  const blog_url = String(body.blog_url || "").trim();
  const status = String(body.status || "active").trim().toLowerCase() || "active";
  const is_default = body.is_default ? 1 : 0;

  if(!id || !blog_id || !blog_name){
    return json(400, "invalid_input", { error:"id_blog_id_blog_name_required" });
  }

  if(action === "create"){
    await env.DB.prepare(`
      INSERT INTO blogspot_sites (
        id, blog_id, blog_name, blog_url, status, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, blog_id, blog_name, blog_url || null, status, is_default, nowSec(), nowSec()
    ).run();
    return json(200, "ok", { created:true, id });
  }

  await env.DB.prepare(`
    UPDATE blogspot_sites
    SET blog_id=?, blog_name=?, blog_url=?, status=?, is_default=?, updated_at=?
    WHERE id=?
  `).bind(
    blog_id, blog_name, blog_url || null, status, is_default, nowSec(), id
  ).run();

  return json(200, "ok", { updated:true, id });
}

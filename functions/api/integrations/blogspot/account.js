import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function allow(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,provider,status,label,blog_id,config_json,created_at,updated_at
    FROM integration_accounts
    WHERE provider='blogspot'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 200
  `).all();

  const accounts = (r.results||[]).map(x=>({
    id:x.id,
    provider:x.provider,
    status:x.status,
    label:x.label,
    blog_id:x.blog_id,
    config_json:x.config_json || "{}",
    created_at:x.created_at,
    updated_at:x.updated_at
  }));

  return json(200,"ok",{ accounts });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const label = String(body.label||"Blogspot Account").trim();
  const blog_id = String(body.blog_id||"").trim();
  const status = String(body.status||"active").trim();
  const config_json = typeof body.config_json === "string" ? body.config_json : JSON.stringify(body.config_json||{});

  if(!blog_id) return json(400,"invalid_input",{ message:"blog_id_required" });
  try{ JSON.parse(config_json); }catch{ return json(400,"invalid_input",{ message:"config_json_invalid" }); }

  const now = nowSec();
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO integration_accounts (id,provider,status,label,blog_id,config_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(id,"blogspot",status,label,blog_id,config_json,now,now).run();

  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  const label = String(body.label||"").trim();
  const blog_id = String(body.blog_id||"").trim();
  const status = String(body.status||"active").trim();
  const config_json = typeof body.config_json === "string" ? body.config_json : JSON.stringify(body.config_json||{});
  try{ JSON.parse(config_json); }catch{ return json(400,"invalid_input",{ message:"config_json_invalid" }); }

  const now = nowSec();
  await env.DB.prepare(`
    UPDATE integration_accounts
    SET label=?, blog_id=?, status=?, config_json=?, updated_at=?
    WHERE id=? AND provider='blogspot'
  `).bind(label||null, blog_id||null, status, config_json, now, id).run();

  return json(200,"ok",{ updated:true });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  await env.DB.prepare(`DELETE FROM integration_accounts WHERE id=? AND provider='blogspot'`).bind(id).run();

  // optional cleanup cached posts/pages/widgets
  await env.DB.prepare(`DELETE FROM cms_posts WHERE provider='blogspot' AND account_id=?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM cms_pages WHERE provider='blogspot' AND account_id=?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM cms_widgets WHERE provider='blogspot' AND account_id=?`).bind(id).run();

  return json(200,"ok",{ deleted:true });
}

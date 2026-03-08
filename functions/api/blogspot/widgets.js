import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";
function canWrite(roles){ return hasRole(roles, ["super_admin","admin"]); }
function canRead(roles){ return hasRole(roles, ["super_admin","admin","staff"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request); if(!a.ok) return a.res;
  if(!canRead(a.roles)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const zone = String(url.searchParams.get("zone")||"").trim();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"100")));

  const r = await env.DB.prepare(`
    SELECT id,zone,title,enabled,config_json,sort_order,created_at,updated_at
    FROM cms_widgets
    WHERE ( ? = '' OR zone = ? )
    ORDER BY zone ASC, sort_order ASC, updated_at DESC
    LIMIT ?
  `).bind(zone, zone, limit).all();

  return json(200,"ok",{ widgets: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request); if(!a.ok) return a.res;
  if(!canWrite(a.roles)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  const zone = String(body.zone||"home").trim();
  const title = String(body.title||"").trim();
  const enabled = Number(body.enabled ?? 1) ? 1 : 0;
  const sort_order = Number(body.sort_order ?? 50);
  const config = body.config && typeof body.config === "object" ? body.config : {};

  if(!zone) return json(400,"invalid_input",{message:"zone"});

  const now = nowSec();
  const wid = id || crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO cms_widgets (id,zone,title,enabled,config_json,sort_order,created_by_user_id,updated_by_user_id,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      zone=excluded.zone,
      title=excluded.title,
      enabled=excluded.enabled,
      config_json=excluded.config_json,
      sort_order=excluded.sort_order,
      updated_by_user_id=excluded.updated_by_user_id,
      updated_at=excluded.updated_at
  `).bind(
    wid, zone, title||null, enabled, JSON.stringify(config), sort_order,
    a.uid, a.uid, now, now
  ).run();

  return json(200,"ok",{ saved:true, id: wid });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request); if(!a.ok) return a.res;
  if(!canWrite(a.roles)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",null);

  await env.DB.prepare("DELETE FROM cms_widgets WHERE id=?").bind(id).run();
  return json(200,"ok",{ deleted:true });
}

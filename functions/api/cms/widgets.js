import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin"]); }
const ACCOUNT_ID = "blogspot_global";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,account_id,widget_key,data_json,status,created_at,updated_at
    FROM cms_widgets
    WHERE account_id=?
    ORDER BY updated_at DESC
  `).bind(ACCOUNT_ID).all();

  const rows = (r.results||[]).map(x=>{
    let data = {};
    try{ data = JSON.parse(x.data_json || "{}"); }catch{}
    return { ...x, data };
  });

  return json(200,"ok",{ widgets: rows });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const widget_key = String(body.widget_key || "").trim();
  const status = String(body.status || "active").trim();
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const data_json = JSON.stringify(data);

  if(!widget_key) return json(400,"invalid_input",{ message:"widget_key_required" });

  const now = nowSec();
  const id = `w_${widget_key}`;

  await env.DB.prepare(`
    INSERT INTO cms_widgets (id,account_id,widget_key,data_json,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      data_json=excluded.data_json,
      status=excluded.status,
      updated_at=excluded.updated_at
  `).bind(id,ACCOUNT_ID,widget_key,data_json,status,now,now).run();

  return json(200,"ok",{ saved:true, id });
}

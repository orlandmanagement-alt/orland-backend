import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

const PROVIDER = "blogspot";
const ACCOUNT_ID = "blogspot_global";

function mustStaff(a){
  return hasRole(a.roles, ["super_admin","admin","staff"]);
}
function mustAdmin(a){
  return hasRole(a.roles, ["super_admin","admin"]);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!mustStaff(a)) return json(403,"forbidden",null);

  const rows = await env.DB.prepare(`
    SELECT id,provider,account_id,widget_key,data_json,status,created_at,updated_at
    FROM cms_widgets
    WHERE provider=? AND account_id=?
    ORDER BY widget_key ASC
  `).bind(PROVIDER, ACCOUNT_ID).all();

  return json(200,"ok",{ widgets: rows.results||[] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!mustAdmin(a)) return json(403,"forbidden",null);

  const body = (await readJson(request)) || {};
  const id = String(body.id||"").trim() || crypto.randomUUID();
  const widget_key = String(body.widget_key||"").trim();
  const status = String(body.status||"active").trim().toLowerCase();
  const data = body.data_json ?? body.data ?? {};
  const data_json = typeof data === "string" ? data : JSON.stringify(data||{});

  if(!widget_key) return json(400,"invalid_input",{message:"widget_key_required"});

  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO cms_widgets (id,provider,account_id,widget_key,data_json,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      widget_key=excluded.widget_key,
      data_json=excluded.data_json,
      status=excluded.status,
      updated_at=excluded.updated_at
  `).bind(id, PROVIDER, ACCOUNT_ID, widget_key, data_json, status, now, now).run();

  return json(200,"ok",{ saved:true, id, widget_key });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!mustAdmin(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  await env.DB.prepare(`DELETE FROM cms_widgets WHERE id=? AND provider=? AND account_id=?`).bind(id, PROVIDER, ACCOUNT_ID).run();
  return json(200,"ok",{ deleted:true, id });
}

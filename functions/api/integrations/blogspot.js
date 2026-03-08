import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin"]); }
const ACCOUNT_ID = "blogspot_global";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const row = await env.DB.prepare(
    "SELECT id,provider,status,config_json,created_at,updated_at FROM integration_accounts WHERE id=? LIMIT 1"
  ).bind(ACCOUNT_ID).first();

  if(!row){
    return json(200,"ok",{ account: { id:ACCOUNT_ID, provider:"blogspot", status:"inactive", config_json:"{}" } });
  }

  let cfg = {};
  try{ cfg = JSON.parse(row.config_json || "{}"); }catch{}
  return json(200,"ok",{ account: { ...row, config: cfg } });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const status = String(body.status || "inactive");
  const config = body.config && typeof body.config === "object" ? body.config : {};
  const config_json = JSON.stringify(config);

  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO integration_accounts (id,provider,status,config_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status,
      config_json=excluded.config_json,
      updated_at=excluded.updated_at
  `).bind(ACCOUNT_ID,"blogspot",status,config_json,now,now).run();

  return json(200,"ok",{ saved:true });
}

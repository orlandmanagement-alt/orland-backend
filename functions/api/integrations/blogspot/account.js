import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

const PROVIDER = "blogspot";
const SCOPE_TYPE = "system";
const SCOPE_ID = "global";
const ACCOUNT_ID = "blogspot_global";

function mustAdmin(a){
  return hasRole(a.roles, ["super_admin","admin"]);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const row = await env.DB.prepare(`
    SELECT id,provider,scope_type,scope_id,status,config_json,created_at,updated_at
    FROM integration_accounts
    WHERE id=? LIMIT 1
  `).bind(ACCOUNT_ID).first();

  if(!row){
    return json(200,"ok",{ account:{
      id:ACCOUNT_ID, provider:PROVIDER, scope_type:SCOPE_TYPE, scope_id:SCOPE_ID,
      status:"inactive", config_json:"{}", created_at:0, updated_at:0
    }});
  }

  return json(200,"ok",{ account: row });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!mustAdmin(a)) return json(403,"forbidden",null);

  const body = (await readJson(request)) || {};
  const status = String(body.status||"inactive").trim();
  const cfg = body.config_json ?? body.config ?? {};
  const cfgJson = typeof cfg === "string" ? cfg : JSON.stringify(cfg||{});

  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO integration_accounts (id,provider,scope_type,scope_id,status,config_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status,
      config_json=excluded.config_json,
      updated_at=excluded.updated_at
  `).bind(ACCOUNT_ID, PROVIDER, SCOPE_TYPE, SCOPE_ID, status, cfgJson, now, now).run();

  return json(200,"ok",{ saved:true, id: ACCOUNT_ID, status });
}

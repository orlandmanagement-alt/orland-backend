import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../../_lib.js";

const PROVIDER = "blogspot";
const SCOPE_TYPE = "system";
const SCOPE_ID = "global";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

async function getAccount(env){
  return await env.DB.prepare(`
    SELECT id,provider,scope_type,scope_id,status,config_json,created_at,updated_at
    FROM integration_accounts
    WHERE provider=? AND scope_type=? AND scope_id=?
    LIMIT 1
  `).bind(PROVIDER, SCOPE_TYPE, SCOPE_ID).first();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const acc = await getAccount(env);
  return json(200,"ok",{ account: acc || null });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const status = String(body.status || "inactive").trim().toLowerCase(); // inactive|active
  const config = body.config_json ?? body.config ?? {};

  const now = nowSec();
  const id = "blogspot_global";

  // upsert
  const existing = await getAccount(env);
  if(existing){
    await env.DB.prepare(`
      UPDATE integration_accounts
      SET status=?, config_json=?, updated_at=?
      WHERE id=?
    `).bind(
      (status === "active" ? "active" : "inactive"),
      JSON.stringify(config || {}),
      now,
      id
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO integration_accounts (id,provider,scope_type,scope_id,status,config_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      id, PROVIDER, SCOPE_TYPE, SCOPE_ID,
      (status === "active" ? "active" : "inactive"),
      JSON.stringify(config || {}),
      now, now
    ).run();
  }

  await audit(env,{ actor_user_id:a.uid, action:"blogspot.settings.save", route:"POST /api/integrations/blogspot/settings", http_status:200, meta:{ status } });
  return json(200,"ok",{ saved:true });
}

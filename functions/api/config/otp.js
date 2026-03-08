import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

function allowRead(a){ return hasRole(a.roles, ["super_admin","admin"]); }
function allowWrite(a){ return hasRole(a.roles, ["super_admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowRead(a)) return json(403,"forbidden",null);

  const row = await env.DB.prepare(`SELECT id,enabled,provider,config_json,updated_at,created_at FROM otp_settings WHERE id='otp_global' LIMIT 1`).first();
  return json(200,"ok",{ row: row || null });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const enabled = body.enabled ? 1 : 0;
  const provider = String(body.provider||"none").trim() || "none";
  const config_json = typeof body.config_json === "string" ? body.config_json : JSON.stringify(body.config||{});

  // allow providers: none|sms|whatsapp|email|custom
  const ok = ["none","sms","whatsapp","email","custom"].includes(provider);
  if(!ok) return json(400,"invalid_input",{message:"provider"});

  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO otp_settings (id,enabled,provider,config_json,updated_at,created_at)
    VALUES ('otp_global',?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      enabled=excluded.enabled,
      provider=excluded.provider,
      config_json=excluded.config_json,
      updated_at=excluded.updated_at
  `).bind(enabled,provider,config_json,now,now).run();

  await audit(env,{actor_user_id:a.uid,action:"config.otp.update",route:"PUT /api/config/otp",http_status:200,meta:{enabled,provider}});
  return json(200,"ok",{ updated:true });
}

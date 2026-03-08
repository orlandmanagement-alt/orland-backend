import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

function allowRead(a){ return hasRole(a.roles, ["super_admin","admin"]); }
function allowWrite(a){ return hasRole(a.roles, ["super_admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowRead(a)) return json(403,"forbidden",null);

  const row = await env.DB.prepare(`
    SELECT id,require_email,require_phone,require_pin,require_ktp,require_selfie,config_json,updated_at,created_at
    FROM verification_settings WHERE id='verify_global' LIMIT 1
  `).first();

  return json(200,"ok",{ row: row || null });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const require_email = body.require_email ? 1 : 0;
  const require_phone = body.require_phone ? 1 : 0;
  const require_pin = body.require_pin ? 1 : 0;
  const require_ktp = body.require_ktp ? 1 : 0;
  const require_selfie = body.require_selfie ? 1 : 0;
  const config_json = typeof body.config_json === "string" ? body.config_json : JSON.stringify(body.config||{});

  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO verification_settings (id,require_email,require_phone,require_pin,require_ktp,require_selfie,config_json,updated_at,created_at)
    VALUES ('verify_global',?,?,?,?,?,?,?, ?,?)
    ON CONFLICT(id) DO UPDATE SET
      require_email=excluded.require_email,
      require_phone=excluded.require_phone,
      require_pin=excluded.require_pin,
      require_ktp=excluded.require_ktp,
      require_selfie=excluded.require_selfie,
      config_json=excluded.config_json,
      updated_at=excluded.updated_at
  `).bind(require_email,require_phone,require_pin,require_ktp,require_selfie,config_json,now,now).run();

  await audit(env,{actor_user_id:a.uid,action:"config.verification.update",route:"PUT /api/config/verification",http_status:200,meta:{require_email,require_phone,require_pin,require_ktp,require_selfie}});
  return json(200,"ok",{ updated:true });
}

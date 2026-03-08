import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

function allowRead(a){ return hasRole(a.roles, ["super_admin","admin"]); }
function allowWrite(a){ return hasRole(a.roles, ["super_admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowRead(a)) return json(403,"forbidden",null);

  const row = await env.DB.prepare(`
    SELECT id,require_email,require_phone,require_pin,pin_min_len,config_json,updated_at,created_at
    FROM admin_security_settings
    WHERE id='admin_sec_global'
    LIMIT 1
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
  const pin_min_len = Math.max(4, Math.min(12, Number(body.pin_min_len || 6)));
  const config_json = typeof body.config_json === "string" ? body.config_json : JSON.stringify(body.config || {});
  try{ JSON.parse(config_json); }catch{ return json(400,"invalid_input",{message:"config_json"}); }

  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO admin_security_settings
      (id,require_email,require_phone,require_pin,pin_min_len,config_json,updated_at,created_at)
    VALUES
      ('admin_sec_global',?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      require_email=excluded.require_email,
      require_phone=excluded.require_phone,
      require_pin=excluded.require_pin,
      pin_min_len=excluded.pin_min_len,
      config_json=excluded.config_json,
      updated_at=excluded.updated_at
  `).bind(require_email,require_phone,require_pin,pin_min_len,config_json,now,now).run();

  await audit(env,{actor_user_id:a.uid,action:"profile.security.update",route:"PUT /api/profile/security",http_status:200,meta:{require_email,require_phone,require_pin,pin_min_len}});
  return json(200,"ok",{ updated:true });
}

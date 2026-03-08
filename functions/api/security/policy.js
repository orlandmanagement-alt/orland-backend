import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const row = await env.DB.prepare(`SELECT * FROM security_policy WHERE id='sec_global' LIMIT 1`).first();
  return json(200,"ok",{ row: row || null });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const now = nowSec();

  function num(k, def, min, max){
    const v = Number(body[k] ?? def);
    if(Number.isNaN(v)) return def;
    return Math.max(min, Math.min(max, v));
  }

  const pw_fail_window_sec = num("pw_fail_window_sec", 900, 60, 86400);
  const pw_fail_max = num("pw_fail_max", 5, 3, 50);
  const lock_sec = num("lock_sec", 900, 60, 86400);
  const rate_limit_per_min = num("rate_limit_per_min", 60, 10, 6000);
  const rate_limit_burst = num("rate_limit_burst", 30, 0, 6000);

  const allowlist_json = typeof body.allowlist_json === "string" ? body.allowlist_json : JSON.stringify(body.allowlist || []);
  const denylist_json = typeof body.denylist_json === "string" ? body.denylist_json : JSON.stringify(body.denylist || []);
  const config_json = typeof body.config_json === "string" ? body.config_json : JSON.stringify(body.config || {});

  try{ JSON.parse(allowlist_json); }catch{ return json(400,"invalid_input",{message:"allowlist_json"}); }
  try{ JSON.parse(denylist_json); }catch{ return json(400,"invalid_input",{message:"denylist_json"}); }
  try{ JSON.parse(config_json); }catch{ return json(400,"invalid_input",{message:"config_json"}); }

  await env.DB.prepare(`
    INSERT INTO security_policy
      (id,pw_fail_window_sec,pw_fail_max,lock_sec,rate_limit_per_min,rate_limit_burst,allowlist_json,denylist_json,config_json,updated_at,created_at)
    VALUES
      ('sec_global',?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      pw_fail_window_sec=excluded.pw_fail_window_sec,
      pw_fail_max=excluded.pw_fail_max,
      lock_sec=excluded.lock_sec,
      rate_limit_per_min=excluded.rate_limit_per_min,
      rate_limit_burst=excluded.rate_limit_burst,
      allowlist_json=excluded.allowlist_json,
      denylist_json=excluded.denylist_json,
      config_json=excluded.config_json,
      updated_at=excluded.updated_at
  `).bind(
    pw_fail_window_sec,pw_fail_max,lock_sec,rate_limit_per_min,rate_limit_burst,
    allowlist_json,denylist_json,config_json,now,now
  ).run();

  await audit(env,{actor_user_id:a.uid,action:"security.policy.update",route:"PUT /api/security/policy",http_status:200,meta:{pw_fail_window_sec,pw_fail_max,lock_sec,rate_limit_per_min,rate_limit_burst}});
  return json(200,"ok",{ updated:true });
}

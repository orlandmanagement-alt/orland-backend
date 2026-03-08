import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../_lib.js";

function allowRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function allowWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowRead(a)) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at
    FROM alert_rules
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 200
  `).all();

  return json(200,"ok",{ rows: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const metric = String(body.metric||"").trim();
  const window_minutes = Number(body.window_minutes||60);
  const threshold = Number(body.threshold||1);
  const severity = String(body.severity||"medium").trim(); // low|medium|high|critical
  const cooldown_minutes = Number(body.cooldown_minutes||60);
  const enabled = body.enabled==null ? 1 : (body.enabled ? 1 : 0);

  if(!metric) return json(400,"invalid_input",{message:"metric"});
  if(!(window_minutes>0 && window_minutes<=1440)) return json(400,"invalid_input",{message:"window_minutes"});
  if(!(threshold>=0)) return json(400,"invalid_input",{message:"threshold"});
  if(!["low","medium","high","critical"].includes(severity)) return json(400,"invalid_input",{message:"severity"});
  if(!(cooldown_minutes>=0 && cooldown_minutes<=10080)) return json(400,"invalid_input",{message:"cooldown_minutes"});

  const id = crypto.randomUUID();
  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO alert_rules (id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,now,now).run();

  await audit(env,{actor_user_id:a.uid,action:"alert_rules.create",route:"POST /api/ops/alert-rules",http_status:200,meta:{id,metric}});
  return json(200,"ok",{created:true,id});
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id"});

  const enabled = body.enabled==null ? null : (body.enabled ? 1 : 0);
  const metric = body.metric!=null ? String(body.metric).trim() : null;
  const window_minutes = body.window_minutes!=null ? Number(body.window_minutes) : null;
  const threshold = body.threshold!=null ? Number(body.threshold) : null;
  const severity = body.severity!=null ? String(body.severity).trim() : null;
  const cooldown_minutes = body.cooldown_minutes!=null ? Number(body.cooldown_minutes) : null;

  if(metric!==null && !metric) return json(400,"invalid_input",{message:"metric"});
  if(window_minutes!==null && !(window_minutes>0 && window_minutes<=1440)) return json(400,"invalid_input",{message:"window_minutes"});
  if(threshold!==null && !(threshold>=0)) return json(400,"invalid_input",{message:"threshold"});
  if(severity!==null && !["low","medium","high","critical"].includes(severity)) return json(400,"invalid_input",{message:"severity"});
  if(cooldown_minutes!==null && !(cooldown_minutes>=0 && cooldown_minutes<=10080)) return json(400,"invalid_input",{message:"cooldown_minutes"});

  const now = nowSec();

  await env.DB.prepare(`
    UPDATE alert_rules
    SET enabled=COALESCE(?,enabled),
        metric=COALESCE(?,metric),
        window_minutes=COALESCE(?,window_minutes),
        threshold=COALESCE(?,threshold),
        severity=COALESCE(?,severity),
        cooldown_minutes=COALESCE(?,cooldown_minutes),
        updated_at=?
    WHERE id=?
  `).bind(enabled,metric,window_minutes,threshold,severity,cooldown_minutes,now,id).run();

  await audit(env,{actor_user_id:a.uid,action:"alert_rules.update",route:"PUT /api/ops/alert-rules",http_status:200,meta:{id}});
  return json(200,"ok",{updated:true});
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowWrite(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id"});

  await env.DB.prepare(`DELETE FROM alert_state WHERE rule_id=?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM alert_rules WHERE id=?`).bind(id).run();

  await audit(env,{actor_user_id:a.uid,action:"alert_rules.delete",route:"DELETE /api/ops/alert-rules",http_status:200,meta:{id}});
  return json(200,"ok",{deleted:true});
}

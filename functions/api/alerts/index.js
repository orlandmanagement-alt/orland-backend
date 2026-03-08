import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function canWrite(roles){ return hasRole(roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id, enabled, metric, window_minutes, threshold, severity, cooldown_minutes, created_at, updated_at
    FROM alert_rules
    ORDER BY created_at DESC
    LIMIT 200
  `).all();

  return json(200,"ok",{ rules: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a.roles)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const metric = String(body.metric||"").trim();
  const window_minutes = Number(body.window_minutes ?? 60);
  const threshold = Number(body.threshold ?? 10);
  const severity = String(body.severity||"medium").trim();
  const cooldown_minutes = Number(body.cooldown_minutes ?? 60);
  const enabled = Number(body.enabled ?? 1) ? 1 : 0;

  if(!metric) return json(400,"invalid_input",{message:"metric"});
  if(!["low","medium","high","critical"].includes(severity)) return json(400,"invalid_input",{message:"severity"});

  const id = crypto.randomUUID();
  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO alert_rules (id, enabled, metric, window_minutes, threshold, severity, cooldown_minutes, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(id, enabled, metric, window_minutes, threshold, severity, cooldown_minutes, now, now).run();

  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a.roles)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id"});

  // partial update
  const cur = await env.DB.prepare(`SELECT * FROM alert_rules WHERE id=? LIMIT 1`).bind(id).first();
  if(!cur) return json(404,"not_found",null);

  const enabled = body.enabled == null ? Number(cur.enabled||0) : (Number(body.enabled)?1:0);
  const metric = body.metric == null ? String(cur.metric||"") : String(body.metric||"").trim();
  const window_minutes = body.window_minutes == null ? Number(cur.window_minutes||60) : Number(body.window_minutes);
  const threshold = body.threshold == null ? Number(cur.threshold||10) : Number(body.threshold);
  const severity = body.severity == null ? String(cur.severity||"medium") : String(body.severity||"medium").trim();
  const cooldown_minutes = body.cooldown_minutes == null ? Number(cur.cooldown_minutes||60) : Number(body.cooldown_minutes);

  if(!metric) return json(400,"invalid_input",{message:"metric"});
  if(!["low","medium","high","critical"].includes(severity)) return json(400,"invalid_input",{message:"severity"});

  await env.DB.prepare(`
    UPDATE alert_rules
    SET enabled=?, metric=?, window_minutes=?, threshold=?, severity=?, cooldown_minutes=?, updated_at=?
    WHERE id=?
  `).bind(enabled, metric, window_minutes, threshold, severity, cooldown_minutes, nowSec(), id).run();

  return json(200,"ok",{ updated:true });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a.roles)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",null);

  await env.DB.prepare(`DELETE FROM alert_rules WHERE id=?`).bind(id).run();
  return json(200,"ok",{ deleted:true });
}

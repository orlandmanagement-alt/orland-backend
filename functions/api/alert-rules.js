import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function allow(a){ return hasRole(a.roles, ["super_admin","admin"]); }
function clampStr(s,n){ s=String(s||"").trim(); return s.length>n ? s.slice(0,n) : s; }
function toInt(v,d){ const n=Number(v); return Number.isFinite(n) ? Math.trunc(n) : d; }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at
    FROM alert_rules
    ORDER BY updated_at DESC
    LIMIT 200
  `).all();

  return json(200,"ok",{ rows: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const now = nowSec();
  const id = crypto.randomUUID();

  const metric = clampStr(body.metric, 80);
  const window_minutes = Math.max(1, Math.min(1440, toInt(body.window_minutes, 5)));
  const threshold = Math.max(1, toInt(body.threshold, 10));
  const severity = clampStr(body.severity, 16) || "medium";
  const cooldown_minutes = Math.max(1, Math.min(1440, toInt(body.cooldown_minutes, 60)));
  const enabled = body.enabled == null ? 1 : (body.enabled ? 1 : 0);

  if(!metric) return json(400,"invalid_input",{ message:"metric_required" });

  await env.DB.prepare(`
    INSERT INTO alert_rules (id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,now,now).run();

  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  const sets = [];
  const bind = [];

  if(body.enabled != null){ sets.push("enabled=?"); bind.push(body.enabled ? 1 : 0); }
  if(body.metric != null){ sets.push("metric=?"); bind.push(clampStr(body.metric,80)); }
  if(body.window_minutes != null){ sets.push("window_minutes=?"); bind.push(Math.max(1,Math.min(1440,toInt(body.window_minutes,5)))); }
  if(body.threshold != null){ sets.push("threshold=?"); bind.push(Math.max(1,toInt(body.threshold,10))); }
  if(body.severity != null){ sets.push("severity=?"); bind.push(clampStr(body.severity,16)); }
  if(body.cooldown_minutes != null){ sets.push("cooldown_minutes=?"); bind.push(Math.max(1,Math.min(1440,toInt(body.cooldown_minutes,60)))); }

  sets.push("updated_at=?"); bind.push(nowSec());
  bind.push(id);

  await env.DB.prepare(`UPDATE alert_rules SET ${sets.join(", ")} WHERE id=?`).bind(...bind).run();
  return json(200,"ok",{ updated:true });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  await env.DB.prepare("DELETE FROM alert_rules WHERE id=?").bind(id).run();
  return json(200,"ok",{ deleted:true });
}

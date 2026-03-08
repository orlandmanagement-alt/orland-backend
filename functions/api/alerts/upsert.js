import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = body.id ? String(body.id) : crypto.randomUUID();
  const enabled = Number(body.enabled ? 1 : 0);
  const metric = String(body.metric||"").trim();
  const window_minutes = Math.max(1, Number(body.window_minutes||30));
  const threshold = Math.max(1, Number(body.threshold||10));
  const severity = String(body.severity||"medium");
  const cooldown_minutes = Math.max(0, Number(body.cooldown_minutes||60));

  if(!metric) return json(400,"invalid_input",{message:"metric"});
  if(!["low","medium","high","critical"].includes(severity)) return json(400,"invalid_input",{message:"severity"});

  const now = nowSec();

  const exists = await env.DB.prepare("SELECT id FROM alert_rules WHERE id=? LIMIT 1").bind(id).first();
  if(exists){
    await env.DB.prepare(`
      UPDATE alert_rules
      SET enabled=?, metric=?, window_minutes=?, threshold=?, severity=?, cooldown_minutes=?, updated_at=?
      WHERE id=?
    `).bind(enabled,metric,window_minutes,threshold,severity,cooldown_minutes,now,id).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO alert_rules (id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,now,now).run();
  }

  return json(200,"ok",{ saved:true, id });
}

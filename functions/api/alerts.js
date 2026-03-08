import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function canRead(roles){ return hasRole(roles, ["super_admin","admin","staff"]); }
function canWrite(roles){ return hasRole(roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a.roles)) return json(403,"forbidden",null);

  const r = await env.DB.prepare(`
    SELECT id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at
    FROM alert_rules
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 200
  `).all();

  return json(200,"ok",{ rows: r.results||[] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a.roles)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim() || null;
  const enabled = Number(body.enabled ?? 1) ? 1 : 0;
  const metric = String(body.metric||"password_fail").trim();
  const window_minutes = Math.max(1, Math.min(1440, Number(body.window_minutes||15)));
  const threshold = Math.max(1, Number(body.threshold||10));
  const severity = String(body.severity||"medium").trim(); // low|medium|high|critical
  const cooldown_minutes = Math.max(1, Math.min(1440, Number(body.cooldown_minutes||60)));

  const now = nowSec();

  if(id){
    await env.DB.prepare(`
      UPDATE alert_rules
      SET enabled=?, metric=?, window_minutes=?, threshold=?, severity=?, cooldown_minutes=?, updated_at=?
      WHERE id=?
    `).bind(enabled,metric,window_minutes,threshold,severity,cooldown_minutes,now,id).run();

    return json(200,"ok",{ updated:true, id });
  }

  const nid = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO alert_rules (id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(nid,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,now,now).run();

  return json(200,"ok",{ created:true, id:nid });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a.roles)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id"});

  await env.DB.prepare(`DELETE FROM alert_rules WHERE id=?`).bind(id).run();
  return json(200,"ok",{ deleted:true });
}

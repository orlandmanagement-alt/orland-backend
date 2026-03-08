import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const severity = String(body.severity||"low");
  const type = String(body.type||"").trim();
  const summary = String(body.summary||"").trim();
  const details_json = body.details_json ? String(body.details_json) : null;

  if(!type || !summary) return json(400,"invalid_input",{message:"type/summary required"});
  if(!["low","medium","high","critical"].includes(severity)) return json(400,"invalid_input",{message:"severity"});

  const id = crypto.randomUUID();
  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO incidents (id,severity,type,summary,status,owner_user_id,details_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(id,severity,type,summary,"open",a.uid,details_json,now,now).run();

  return json(200,"ok",{ created:true, id });
}

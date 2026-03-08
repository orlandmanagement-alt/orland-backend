import { json, requireAuth, hasRole } from "../../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const incident_id = String(url.searchParams.get("incident_id")||"").trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||50)));

  if(!incident_id) return json(400,"invalid_input",{message:"incident_id_required"});

  const r = await env.DB.prepare(`
    SELECT id,incident_id,author_user_id,body,created_at
    FROM incident_comments
    WHERE incident_id=?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(incident_id, limit).all();

  return json(200,"ok",{ rows: r.results || [] });
}

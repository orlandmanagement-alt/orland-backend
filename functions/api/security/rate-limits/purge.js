import { json, readJson, requireAuth, hasRole } from "../../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const kind = String(body.kind||"password_fail");
  const minutes = Math.max(5, Math.min(1440, Number(body.minutes||240)));
  const windowStart = Math.floor(Date.now()/1000) - (minutes*60);

  const r = await env.DB.prepare(`DELETE FROM ip_activity WHERE kind=? AND window_start >= ?`)
    .bind(kind, windowStart).run();

  return json(200,"ok",{ deleted: r.meta?.changes || 0, kind, minutes });
}

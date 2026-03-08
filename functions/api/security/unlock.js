import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const user_id = String(body.user_id || "");
  if(!user_id) return json(400,"invalid_input",null);

  const now = nowSec();
  await env.DB.prepare(`
    UPDATE users
    SET pw_fail_count=0, pw_fail_window_start=0, locked_until=0, lock_reason=NULL, updated_at=?
    WHERE id=?
  `).bind(now, user_id).run();

  return json(200,"ok",{ unlocked:true, user_id });
}

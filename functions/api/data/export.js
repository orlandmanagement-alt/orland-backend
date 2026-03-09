import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  // stub (no heavy work). in future: enqueue tasks table.
  return json(200,"ok",{
    mode:"stub",
    message:"Export endpoint ready. Next: enqueue background task into tasks table.",
    now: nowSec()
  });
}

import { json, readJson, requireAuth, hasRole } from "../../../_lib.js";
import { bumpMetric } from "./metrics_writer.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action || "").trim();
  const amount = Number(body.amount || 1);

  if(!action) return json(400,"invalid_input",{ message:"action_required" });

  const r = await bumpMetric(env, action, amount);
  return json(200,"ok", r);
}

import { json } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";
import { getBreakerConfig, breakerStatusSummary } from "./job_breaker_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  return json(200, "ok", {
    config: await getBreakerConfig(env),
    summary: await breakerStatusSummary(env)
  });
}

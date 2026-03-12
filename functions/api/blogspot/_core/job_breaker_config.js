import { json, readJson } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";
import { getBreakerConfig, setBreakerConfig } from "./job_breaker_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;
  return json(200, "ok", await getBreakerConfig(env));
}

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  await setBreakerConfig(env, "breaker_enabled", body.breaker_enabled === false ? "0" : "1");
  await setBreakerConfig(env, "fail_threshold", Math.max(1, Math.min(100, Number(body.fail_threshold || 5))));
  await setBreakerConfig(env, "reopen_sec", Math.max(10, Math.min(86400, Number(body.reopen_sec || 300))));
  await setBreakerConfig(env, "half_open_success_needed", Math.max(1, Math.min(20, Number(body.half_open_success_needed || 2))));
  await setBreakerConfig(env, "quota_warn_threshold_minute", Math.max(1, Math.min(10000, Number(body.quota_warn_threshold_minute || 60))));
  await setBreakerConfig(env, "quota_warn_threshold_day", Math.max(1, Math.min(1000000, Number(body.quota_warn_threshold_day || 2000))));

  return json(200, "ok", {
    saved: true,
    config: await getBreakerConfig(env)
  });
}

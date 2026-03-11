import { json, requireAuth, hasRole } from "../../_lib.js";
import { getBlogspotConfig, bloggerUrl, bloggerFetch, missingConfig, upstreamError } from "./_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const cfg = await getBlogspotConfig(env);
  if(!cfg.enabled) return json(200,"ok",{ enabled:false });

  const miss = missingConfig(cfg);
  if(miss.length) return json(400,"invalid_config",{ missing: miss });

  const url = bloggerUrl(`blogs/${cfg.blog_id}`, { key: cfg.api_key });
  const res = await bloggerFetch(url);
  if(!res.ok) return upstreamError(res);

  return json(200,"ok",{
    enabled:true,
    blog: res.data
  });
}

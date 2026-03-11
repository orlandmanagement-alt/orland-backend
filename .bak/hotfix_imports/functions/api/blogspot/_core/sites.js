import { json } from "../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotConfig,
  bloggerUrl,
  bloggerFetch,
  missingConfig,
  missingBlogspotFields,
  upstreamError
} from "./_core/_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const cfg = await getBlogspotConfig(env);
  if(!cfg.enabled) return json(200, "ok", { enabled:false });

  const miss = missingBlogspotFields(cfg);
  if(miss.length) return missingConfig(cfg);

  const url = bloggerUrl(cfg.blog_id, "", {}, cfg.api_key);
  const res = await bloggerFetch(url);
  if(!res.ok) return upstreamError(res.status, res.data || res.text || "");

  return json(200, "ok", {
    enabled: true,
    blog: res.data
  });
}

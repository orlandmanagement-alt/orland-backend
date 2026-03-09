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

  const blogUrl = bloggerUrl(`blogs/${cfg.blog_id}`, { key: cfg.api_key });
  const postsUrl = bloggerUrl(`blogs/${cfg.blog_id}/posts`, {
    key: cfg.api_key,
    fetchBodies: "false",
    status: "live",
    maxResults: 5
  });
  const pagesUrl = bloggerUrl(`blogs/${cfg.blog_id}/pages`, {
    key: cfg.api_key,
    fetchBodies: "false",
    status: "live",
    maxResults: 5
  });

  const [blogRes, postsRes, pagesRes] = await Promise.all([
    bloggerFetch(blogUrl),
    bloggerFetch(postsUrl),
    bloggerFetch(pagesUrl)
  ]);

  if(!blogRes.ok) return upstreamError(blogRes);
  if(!postsRes.ok) return upstreamError(postsRes);
  if(!pagesRes.ok) return upstreamError(pagesRes);

  return json(200,"ok",{
    enabled:true,
    mode:"home_fallback",
    blog: blogRes.data || {},
    recent_posts: postsRes.data?.items || [],
    recent_pages: pagesRes.data?.items || [],
    note:"Widgets CRUD tidak tersedia resmi di Blogger API v3. Endpoint ini menampilkan data home fallback."
  });
}

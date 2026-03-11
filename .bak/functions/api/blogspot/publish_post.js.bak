import { json, readJson, nowSec } from "../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotConfig,
  getBlogspotOAuthConfig,
  refreshBlogspotAccessToken,
  bloggerFetch,
  markMapDirty
} from "./_service.js";

function s(v){ return String(v || "").trim(); }

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const id = s(body.id);
  if(!id) return json(400, "invalid_input", { error:"id_required" });

  const cfg = await getBlogspotConfig(env);
  if(!cfg.enabled || !cfg.blog_id){
    return json(400, "invalid_config", { error:"blogspot_config_missing" });
  }

  const oauth = await getBlogspotOAuthConfig(env);
  if(!oauth.enabled){
    return json(400, "invalid_config", { error:"oauth_disabled" });
  }

  const tk = await refreshBlogspotAccessToken(env);
  if(!tk.ok){
    return json(400, "invalid_config", { error: tk.error || "oauth_refresh_failed", detail: tk.data || null });
  }

  const row = await env.DB.prepare(`
    SELECT id, title, slug, status, content_html, labels_json, external_id
    FROM cms_posts
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!row) return json(404, "not_found", { error:"post_not_found" });

  const labels = (() => {
    try{ return JSON.parse(String(row.labels_json || "[]")); }
    catch{ return []; }
  })();

  const isDraft = String(row.status || "draft") !== "published" ? "true" : "false";
  const hasRemote = !!String(row.external_id || "").trim();
  const endpoint = hasRemote
    ? `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(cfg.blog_id)}/posts/${encodeURIComponent(String(row.external_id))}?isDraft=${isDraft}`
    : `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(cfg.blog_id)}/posts?isDraft=${isDraft}`;

  const payload = {
    kind: "blogger#post",
    title: row.title || "",
    content: row.content_html || "",
    labels: Array.isArray(labels) ? labels : []
  };

  const res = await bloggerFetch(endpoint, {
    method: hasRemote ? "PUT" : "POST",
    headers: {
      "authorization": "Bearer " + tk.access_token,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if(!res.ok){
    return json(502, "server_error", {
      error: "remote_publish_failed",
      http: res.status,
      body: res.data || res.text || ""
    });
  }

  const remote = res.data || {};
  const now = nowSec();

  await env.DB.prepare(`
    UPDATE cms_posts
    SET external_id=?, blog_id=?, url=?, published_at=?, updated_at=?
    WHERE id=?
  `).bind(
    String(remote.id || row.external_id || ""),
    cfg.blog_id,
    remote.url || null,
    remote.published ? Math.floor(new Date(remote.published).getTime() / 1000) : null,
    now,
    id
  ).run();

  await markMapDirty(env, "post", id, {
    remote_id: String(remote.id || row.external_id || ""),
    title: row.title || "",
    slug: row.slug || "",
    remote_updated: String(remote.updated || ""),
    last_synced_at: now,
    last_pushed_at: now,
    dirty: 0,
    deleted_local: 0,
    deleted_remote: 0,
    action: hasRemote ? "remote_update" : "remote_create",
    direction: "push",
    message: "post published to blogger",
    payload_json: {
      remote_id: remote.id || "",
      remote_url: remote.url || "",
      status: row.status || "draft"
    }
  });

  return json(200, "ok", {
    published: true,
    id,
    remote_id: remote.id || "",
    remote_url: remote.url || ""
  });
}

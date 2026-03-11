import { json, readJson, nowSec } from "../../_lib.js";
import {
  blogspotGet,
  requireBlogspotAccess,
  getBlogspotConfig,
  makeId,
  safeJsonParse,
  markMapDirty
} from "./_service.js";

function s(v){ return String(v || "").trim(); }
function n(v, d = 0){ const x = Number(v); return Number.isFinite(x) ? x : d; }

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const source = s(url.searchParams.get("source") || "local").toLowerCase();

  if(source === "remote"){
    const maxResults = Math.max(1, Math.min(50, Number(url.searchParams.get("maxResults") || "20")));
    return await blogspotGet(env, "/pages", { maxResults });
  }

  const cfg = await getBlogspotConfig(env);
  const rows = await env.DB.prepare(`
    SELECT
      p.id, p.provider, p.account_id, p.external_id, p.blog_id, p.title, p.slug, p.status, p.url,
      p.content_html, p.meta_json, p.published_at, p.updated_at, p.created_at,
      m.remote_id AS map_remote_id,
      m.remote_updated AS map_remote_updated,
      m.last_synced_at AS map_last_synced_at,
      m.last_pushed_at AS map_last_pushed_at,
      m.dirty AS map_dirty,
      m.deleted_local AS map_deleted_local,
      m.deleted_remote AS map_deleted_remote
    FROM cms_pages p
    LEFT JOIN blogspot_post_map m
      ON m.local_id = p.id
     AND m.kind = 'page'
    WHERE p.provider = 'blogspot'
    ORDER BY COALESCE(p.updated_at, p.created_at) DESC, p.created_at DESC
  `).all();

  const items = (rows.results || []).map(x => ({
    ...x,
    meta_json: safeJsonParse(x.meta_json, {}),
    map_dirty: Number(x.map_dirty || 0),
    map_deleted_local: Number(x.map_deleted_local || 0),
    map_deleted_remote: Number(x.map_deleted_remote || 0),
    map_last_synced_at: Number(x.map_last_synced_at || 0),
    map_last_pushed_at: Number(x.map_last_pushed_at || 0)
  }));

  return json(200, "ok", {
    source: "local",
    enabled: cfg.enabled,
    configured: !!(cfg.blog_id && cfg.api_key),
    items
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const action = s(body.action || "create").toLowerCase();
  const cfg = await getBlogspotConfig(env);
  const now = nowSec();

  if(action === "delete"){
    const id = s(body.id);
    if(!id) return json(400, "invalid_input", { error:"id_required" });

    const row = await env.DB.prepare(`SELECT id, title, slug FROM cms_pages WHERE id=? LIMIT 1`).bind(id).first();
    if(!row) return json(404, "not_found", { error:"page_not_found" });

    await env.DB.prepare(`DELETE FROM cms_pages WHERE id=?`).bind(id).run();
    await markMapDirty(env, "page", id, {
      title: row.title || "",
      slug: row.slug || "",
      dirty: 1,
      deleted_local: 1,
      action: "delete",
      message: "local page deleted"
    });

    return json(200, "ok", { deleted:true, id });
  }

  const mode = action === "update" ? "update" : "create";
  const id = mode === "create" ? (s(body.id) || makeId("page")) : s(body.id);
  if(!id) return json(400, "invalid_input", { error:"id_required" });

  const title = s(body.title);
  if(!title) return json(400, "invalid_input", { error:"title_required" });

  const slug = s(body.slug);
  const status = s(body.status || "draft") || "draft";
  const urlValue = s(body.url || "");
  const content_html = String(body.content_html || "");
  const meta = body.meta_json && typeof body.meta_json === "object" ? body.meta_json : {};
  const published_at = body.published_at ? n(body.published_at, now) : null;

  if(mode === "update"){
    const ex = await env.DB.prepare(`SELECT id FROM cms_pages WHERE id=? LIMIT 1`).bind(id).first();
    if(!ex) return json(404, "not_found", { error:"page_not_found" });

    await env.DB.prepare(`
      UPDATE cms_pages
      SET provider=?, account_id=?, external_id=?, blog_id=?, title=?, slug=?, status=?, url=?,
          content_html=?, meta_json=?, published_at=?, updated_at=?
      WHERE id=?
    `).bind(
      "blogspot",
      cfg.blog_id || "local",
      s(body.external_id || ""),
      cfg.blog_id || null,
      title,
      slug || null,
      status,
      urlValue || null,
      content_html,
      JSON.stringify(meta),
      published_at,
      now,
      id
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO cms_pages (
        id, provider, account_id, external_id, blog_id, title, slug, status, url,
        content_html, meta_json, published_at, updated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      "blogspot",
      cfg.blog_id || "local",
      s(body.external_id || ""),
      cfg.blog_id || null,
      title,
      slug || null,
      status,
      urlValue || null,
      content_html,
      JSON.stringify(meta),
      published_at,
      now,
      now
    ).run();
  }

  await markMapDirty(env, "page", id, {
    title,
    slug,
    dirty: 1,
    deleted_local: 0,
    deleted_remote: 0,
    action: mode,
    message: "local page changed"
  });

  return json(200, "ok", {
    saved: true,
    mode,
    id
  });
}

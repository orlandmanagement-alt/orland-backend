import { json, readJson, nowSec } from "../../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotConfig,
  bloggerUrl,
  bloggerFetch,
  markMapDirty
} from "./_service.js";
import { appendLedgerEvent } from "./audit_ledger_shared.js";
import { resolveActiveSite } from "./site_shared.js";

function s(v){ return String(v || "").trim(); }

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const id = s(body.id);
  if(!id) return json(400, "invalid_input", { error:"id_required" });

  const activeSite = await resolveActiveSite(env, s(body.site_id || ""));
  const cfg = await getBlogspotConfig(env);
  if(!cfg.enabled || !cfg.blog_id || !cfg.api_key){
    return json(400, "invalid_config", { error:"blogspot_config_missing" });
  }

  const row = await env.DB.prepare(`
    SELECT id, title, slug, external_id, url
    FROM cms_posts
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!row) return json(404, "not_found", { error:"post_not_found" });

  const remoteId = s(row.external_id);
  if(!remoteId){
    return json(400, "invalid_input", { error:"remote_id_missing" });
  }

  const now = nowSec();
  const url = bloggerUrl(cfg.blog_id, "/posts/" + encodeURIComponent(remoteId), {}, cfg.api_key);
  const res = await bloggerFetch(url, { method:"GET" });

  if(!res.ok){
    if(Number(res.status) === 404){
      await markMapDirty(env, "post", id, {
        remote_id: remoteId,
        title: row.title || "",
        slug: row.slug || "",
        last_synced_at: now,
        dirty: 1,
        deleted_local: 0,
        deleted_remote: 1,
        action: "remote_refresh_missing",
        direction: "pull",
        message: "remote post missing",
        payload_json: {
          remote_id: remoteId,
          site_id: activeSite?.id || null
        }
      });

      try{
        await appendLedgerEvent(env, {
          site_id: activeSite?.id || null,
          event_type: "refresh_remote_post_missing",
          item_kind: "post",
          item_id: id,
          actor_user_id: a.uid || null,
          payload: { remote_id: remoteId }
        });
      }catch{}

      return json(200, "ok", {
        found: false,
        remote_deleted: true,
        id,
        remote_id: remoteId,
        site_id: activeSite?.id || null
      });
    }

    return json(502, "server_error", {
      error: "remote_refresh_failed",
      http: res.status,
      body: res.data || res.text || ""
    });
  }

  const remote = res.data || {};

  await env.DB.prepare(`
    UPDATE cms_posts
    SET external_id=?,
        blog_id=?,
        url=?,
        published_at=?,
        updated_at=?
    WHERE id=?
  `).bind(
    s(remote.id || remoteId),
    cfg.blog_id,
    remote.url || row.url || null,
    remote.published ? Math.floor(new Date(remote.published).getTime() / 1000) : null,
    now,
    id
  ).run();

  await markMapDirty(env, "post", id, {
    remote_id: s(remote.id || remoteId),
    title: row.title || "",
    slug: row.slug || "",
    remote_updated: s(remote.updated || ""),
    last_synced_at: now,
    dirty: 0,
    deleted_local: 0,
    deleted_remote: 0,
    action: "remote_refresh",
    direction: "pull",
    message: "remote post refreshed",
    payload_json: {
      remote_id: remote.id || remoteId,
      remote_url: remote.url || "",
      site_id: activeSite?.id || null
    }
  });

  try{
    await appendLedgerEvent(env, {
      site_id: activeSite?.id || null,
      event_type: "refresh_remote_post",
      item_kind: "post",
      item_id: id,
      actor_user_id: a.uid || null,
      payload: {
        remote_id: remote.id || remoteId,
        remote_url: remote.url || ""
      }
    });
  }catch{}

  return json(200, "ok", {
    found: true,
    remote_deleted: false,
    id,
    site_id: activeSite?.id || null,
    remote: {
      id: remote.id || remoteId,
      title: remote.title || "",
      url: remote.url || "",
      published: remote.published || "",
      updated: remote.updated || ""
    }
  });
}

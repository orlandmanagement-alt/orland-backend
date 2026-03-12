import { json, readJson, nowSec } from "../../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotConfig,
  getBlogspotOAuthConfig,
  refreshBlogspotAccessToken,
  bloggerFetch,
  markMapDirty
} from "./_service.js";
import { appendLedgerEvent } from "./audit_ledger_shared.js";
import { resolveActiveSite } from "./site_shared.js";

function s(v){ return String(v || "").trim(); }

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const id = s(body.id);
  if(!id) return json(400, "invalid_input", { error:"id_required" });

  const activeSite = await resolveActiveSite(env, s(body.site_id || ""));
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
    return json(400, "invalid_config", {
      error: tk.error || "oauth_refresh_failed",
      detail: tk.data || null
    });
  }

  const row = await env.DB.prepare(`
    SELECT id, title, slug, external_id
    FROM cms_pages
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!row) return json(404, "not_found", { error:"page_not_found" });

  const remoteId = s(row.external_id);
  if(!remoteId){
    return json(400, "invalid_input", { error:"remote_id_missing" });
  }

  const endpoint = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(cfg.blog_id)}/pages/${encodeURIComponent(remoteId)}`;
  const res = await bloggerFetch(endpoint, {
    method: "DELETE",
    headers: {
      "authorization": "Bearer " + tk.access_token
    }
  });

  if(!res.ok && Number(res.status) !== 404){
    return json(502, "server_error", {
      error: "remote_delete_failed",
      http: res.status,
      body: res.data || res.text || ""
    });
  }

  const now = nowSec();

  await env.DB.prepare(`
    UPDATE cms_pages
    SET external_id='',
        updated_at=?
    WHERE id=?
  `).bind(now, id).run();

  await markMapDirty(env, "page", id, {
    remote_id: remoteId,
    title: row.title || "",
    slug: row.slug || "",
    last_synced_at: now,
    last_pushed_at: now,
    dirty: 0,
    deleted_local: 0,
    deleted_remote: 1,
    action: "remote_delete",
    direction: "push",
    message: "page deleted on blogger",
    payload_json: {
      remote_id: remoteId,
      site_id: activeSite?.id || null
    }
  });

  try{
    await appendLedgerEvent(env, {
      site_id: activeSite?.id || null,
      event_type: "delete_remote_page",
      item_kind: "page",
      item_id: id,
      actor_user_id: a.uid || null,
      payload: { remote_id: remoteId }
    });
  }catch{}

  return json(200, "ok", {
    deleted: true,
    id,
    remote_id: remoteId,
    site_id: activeSite?.id || null
  });
}

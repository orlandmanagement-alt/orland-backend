import { json } from "../../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotConfig,
  bloggerUrl,
  bloggerFetch,
  getLinkedLocalItems,
  buildLocalContentHash,
  buildRemoteContentHash,
  markMapDirty,
  getSyncConfigValue
} from "./_service.js";

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const enabled = await getSyncConfigValue(env, "drift_scan_enabled", "1");
  if(enabled !== "1"){
    return json(200, "ok", { ran:false, status:"skipped", message:"drift_scan_disabled" });
  }

  const cfg = await getBlogspotConfig(env);
  if(!cfg.enabled || !cfg.blog_id || !cfg.api_key){
    return json(400, "invalid_config", { error:"blogspot_config_missing" });
  }

  const linkedPosts = await getLinkedLocalItems(env, "post", 50);
  const linkedPages = await getLinkedLocalItems(env, "page", 50);

  const out = {
    ran: true,
    posts_scanned: 0,
    pages_scanned: 0,
    drift_detected: 0
  };

  for(const row of linkedPosts){
    const remoteId = String(row.external_id || row.remote_id || "").trim();
    if(!remoteId) continue;
    out.posts_scanned++;

    const url = bloggerUrl(cfg.blog_id, "/posts/" + encodeURIComponent(remoteId), {}, cfg.api_key);
    const res = await bloggerFetch(url, { method:"GET" });
    if(!res.ok || !res.data) continue;

    const localHash = buildLocalContentHash(row);
    const remoteHash = buildRemoteContentHash(res.data);

    if(localHash !== remoteHash){
      out.drift_detected++;
      await markMapDirty(env, "post", row.id, {
        remote_id: remoteId,
        title: row.title || "",
        slug: row.slug || "",
        remote_url: res.data.url || null,
        remote_status: "linked",
        remote_updated: String(res.data.updated || ""),
        dirty: Number(row.dirty || 0) ? 1 : 0,
        deleted_local: 0,
        deleted_remote: 0,
        sync_state: "drift_detected",
        sync_error: "remote_changed_outside_system",
        last_local_hash: localHash,
        last_remote_hash: remoteHash,
        last_actor_user_id: a.uid || null,
        action: "drift_scan",
        direction: "pull",
        status: "ok",
        message: "remote drift detected on post",
        payload_json: { local_id: row.id, remote_id: remoteId }
      });
    }
  }

  for(const row of linkedPages){
    const remoteId = String(row.external_id || row.remote_id || "").trim();
    if(!remoteId) continue;
    out.pages_scanned++;

    const url = bloggerUrl(cfg.blog_id, "/pages/" + encodeURIComponent(remoteId), {}, cfg.api_key);
    const res = await bloggerFetch(url, { method:"GET" });
    if(!res.ok || !res.data) continue;

    const localHash = buildLocalContentHash(row);
    const remoteHash = buildRemoteContentHash(res.data);

    if(localHash !== remoteHash){
      out.drift_detected++;
      await markMapDirty(env, "page", row.id, {
        remote_id: remoteId,
        title: row.title || "",
        slug: row.slug || "",
        remote_url: res.data.url || null,
        remote_status: "linked",
        remote_updated: String(res.data.updated || ""),
        dirty: Number(row.dirty || 0) ? 1 : 0,
        deleted_local: 0,
        deleted_remote: 0,
        sync_state: "drift_detected",
        sync_error: "remote_changed_outside_system",
        last_local_hash: localHash,
        last_remote_hash: remoteHash,
        last_actor_user_id: a.uid || null,
        action: "drift_scan",
        direction: "pull",
        status: "ok",
        message: "remote drift detected on page",
        payload_json: { local_id: row.id, remote_id: remoteId }
      });
    }
  }

  return json(200, "ok", out);
}

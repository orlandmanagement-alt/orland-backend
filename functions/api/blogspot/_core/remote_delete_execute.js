import { json, readJson, nowSec, hasRole } from "../../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotConfig,
  getBlogspotOAuthConfig,
  refreshBlogspotAccessToken,
  bloggerFetch,
  addSyncLog,
  markMapDirty,
  assertWriteAllowed
} from "./_service.js";

function s(v){ return String(v || "").trim(); }

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const request_id = s(body.request_id);

  if(!request_id){
    return json(400, "invalid_input", { error:"request_id_required" });
  }

  const reqRow = await env.DB.prepare(`
    SELECT id, kind, local_id, remote_id, status, title, slug
    FROM blogspot_remote_delete_requests
    WHERE id=?
    LIMIT 1
  `).bind(request_id).first();

  if(!reqRow){
    return json(404, "not_found", { error:"request_not_found" });
  }

  if(String(reqRow.status || "") !== "approved"){
    return json(400, "invalid_input", { error:"request_not_approved" });
  }

  const writeGuard = await assertWriteAllowed(env, {
    action: "delete_remote",
    requiresApproval: true,
    approved: true
  });
  if(!writeGuard.ok) return writeGuard.res;

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

  const kind = s(reqRow.kind);
  const remote_id = s(reqRow.remote_id);

  let endpoint = "";
  if(kind === "post"){
    endpoint = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(cfg.blog_id)}/posts/${encodeURIComponent(remote_id)}`;
  }else if(kind === "page"){
    endpoint = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(cfg.blog_id)}/pages/${encodeURIComponent(remote_id)}`;
  }else{
    return json(400, "invalid_input", { error:"invalid_kind" });
  }

  const res = await bloggerFetch(endpoint, {
    method: "DELETE",
    headers: {
      "authorization": "Bearer " + tk.access_token
    }
  });

  const now = nowSec();

  if(!res.ok && Number(res.status) !== 404){
    await env.DB.prepare(`
      UPDATE blogspot_remote_delete_requests
      SET executed_by=?, executed_at=?, result_status=?, result_message=?
      WHERE id=?
    `).bind(
      a.uid || null,
      now,
      "error",
      String(res.text || JSON.stringify(res.data || {})).slice(0, 1000),
      request_id
    ).run();

    await addSyncLog(env, {
      direction: "push",
      kind,
      local_id: reqRow.local_id || null,
      remote_id,
      actor_user_id: a.uid || null,
      action: "remote_delete_execute",
      status: "error",
      message: "remote delete failed",
      payload_json: {
        request_id,
        http: res.status,
        body: res.data || res.text || ""
      }
    });

    return json(502, "server_error", {
      error: "remote_delete_failed",
      http: res.status,
      body: res.data || res.text || ""
    });
  }

  await env.DB.prepare(`
    UPDATE blogspot_remote_delete_requests
    SET status='executed',
        executed_by=?,
        executed_at=?,
        result_status='ok',
        result_message='remote deleted'
    WHERE id=?
  `).bind(
    a.uid || null,
    now,
    request_id
  ).run();

  await markMapDirty(env, kind, String(reqRow.local_id || ""), {
    remote_id,
    title: reqRow.title || "",
    slug: reqRow.slug || "",
    dirty: 0,
    deleted_local: 0,
    deleted_remote: 1,
    sync_state: "remote_deleted",
    sync_error: null,
    last_synced_at: now,
    last_actor_user_id: a.uid || null,
    action: "remote_delete_execute",
    direction: "push",
    status: "ok",
    message: "remote content deleted after approval",
    payload_json: {
      request_id,
      remote_id
    }
  });

  if(kind === "post"){
    await env.DB.prepare(`
      UPDATE cms_posts
      SET remote_status='deleted_remote',
          updated_at=?
      WHERE id=?
    `).bind(now, reqRow.local_id).run();
  }else{
    await env.DB.prepare(`
      UPDATE cms_pages
      SET remote_status='deleted_remote',
          updated_at=?
      WHERE id=?
    `).bind(now, reqRow.local_id).run();
  }

  return json(200, "ok", {
    executed: true,
    request_id,
    kind,
    local_id: reqRow.local_id,
    remote_id
  });
}

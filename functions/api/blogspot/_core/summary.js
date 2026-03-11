import { json } from "../../_lib.js";
import { requireBlogspotAccess, getBlogspotConfig } from "./_core/_service.js";

async function getState(env, k){
  const row = await env.DB.prepare(
    "SELECT v FROM blogspot_sync_state WHERE k=? LIMIT 1"
  ).bind(k).first();
  return row ? String(row.v || "") : "";
}

async function countOne(env, sql, ...binds){
  const row = await env.DB.prepare(sql).bind(...binds).first();
  return Number(row?.total || 0);
}

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const cfg = await getBlogspotConfig(env);

  const [
    local_posts,
    local_pages,
    active_widgets,
    dirty_posts,
    dirty_pages,
    remote_deleted_posts,
    remote_deleted_pages
  ] = await Promise.all([
    countOne(env, `SELECT COUNT(*) AS total FROM cms_posts WHERE provider='blogspot'`),
    countOne(env, `SELECT COUNT(*) AS total FROM cms_pages WHERE provider='blogspot'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_widget_home WHERE status='active'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE kind='post' AND dirty=1`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE kind='page' AND dirty=1`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE kind='post' AND deleted_remote=1`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE kind='page' AND deleted_remote=1`)
  ]);

  const last_run_at = await getState(env, "last_run_at");
  const last_success_at = await getState(env, "last_success_at");
  const last_status = await getState(env, "last_status");
  const last_message = await getState(env, "last_message");

  return json(200, "ok", {
    enabled: !!cfg.enabled,
    configured: !!(cfg.blog_id && cfg.api_key),
    blog_id: cfg.blog_id || "",
    local_posts,
    local_pages,
    active_widgets,
    dirty_total: Number(dirty_posts || 0) + Number(dirty_pages || 0),
    dirty_posts,
    dirty_pages,
    remote_deleted_total: Number(remote_deleted_posts || 0) + Number(remote_deleted_pages || 0),
    remote_deleted_posts,
    remote_deleted_pages,
    sync: {
      last_run_at: Number(last_run_at || 0),
      last_success_at: Number(last_success_at || 0),
      last_status: last_status || "idle",
      last_message: last_message || ""
    }
  });
}

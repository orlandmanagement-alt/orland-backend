import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function getKV(env, k){
  const row = await env.DB.prepare(
    "SELECT v FROM system_settings WHERE k=? LIMIT 1"
  ).bind(k).first();
  return row ? String(row.v || "") : "";
}

export async function requireBlogspotAccess(env, request, allowStaff = true){
  const a = await requireAuth(env, request);
  if(!a.ok) return a;

  const allowed = allowStaff
    ? ["super_admin","admin","staff"]
    : ["super_admin","admin"];

  if(!hasRole(a.roles, allowed)){
    return { ok:false, res: json(403, "forbidden", null) };
  }

  return a;
}

export async function getBlogspotConfig(env){
  const enabled = await getKV(env, "blogspot_enabled");
  const blog_id = await getKV(env, "blogspot_blog_id");
  const api_key = await getKV(env, "blogspot_api_key");

  return {
    enabled: enabled === "1",
    blog_id,
    api_key,
    api_key_configured: !!api_key
  };
}

export function missingBlogspotFields(cfg){
  const miss = [];
  if(!cfg?.blog_id) miss.push("blog_id");
  if(!cfg?.api_key) miss.push("api_key");
  return miss;
}

export function missingConfig(cfg = null){
  const miss = missingBlogspotFields(cfg || {});
  return json(200, "ok", {
    enabled: cfg?.enabled !== false,
    configured: false,
    missing: miss,
    message: "missing_blogspot_config"
  });
}

export function upstreamError(status, body){
  return json(502, "server_error", {
    http: Number(status || 502),
    body
  });
}

export function bloggerUrl(blogId, endpoint = "", params = {}, apiKey = ""){
  const cleanBlogId = encodeURIComponent(String(blogId || ""));
  const cleanEndpoint = String(endpoint || "");
  const u = new URL("https://www.googleapis.com/blogger/v3/blogs/" + cleanBlogId + cleanEndpoint);

  if(apiKey) u.searchParams.set("key", String(apiKey));

  for(const [k, v] of Object.entries(params || {})){
    if(v !== undefined && v !== null && String(v) !== ""){
      u.searchParams.set(k, String(v));
    }
  }

  return u.toString();
}

export async function bloggerFetch(url){
  try{
    const res = await fetch(url, {
      method: "GET",
      headers: { "accept": "application/json" }
    });

    const ct = res.headers.get("content-type") || "";

    if(!ct.includes("application/json")){
      const t = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        data: null,
        text: t.slice(0, 1000)
      };
    }

    const data = await res.json().catch(() => null);

    return {
      ok: res.ok,
      status: res.status,
      data,
      text: ""
    };
  }catch(e){
    return {
      ok: false,
      status: 500,
      data: null,
      text: String(e?.message || e)
    };
  }
}

export async function blogspotGet(env, endpoint, params = {}){
  const cfg = await getBlogspotConfig(env);

  if(!cfg.enabled){
    return json(200, "ok", { enabled:false, configured:false, items:[] });
  }

  if(!cfg.blog_id || !cfg.api_key){
    return missingConfig(cfg);
  }

  const url = bloggerUrl(cfg.blog_id, endpoint, params, cfg.api_key);
  const r = await bloggerFetch(url);

  if(!r.ok){
    return upstreamError(r.status, r.data || r.text || "");
  }

  return json(200, "ok", r.data);
}

export function makeId(prefix = "id"){
  return `${prefix}_${crypto.randomUUID()}`;
}

export function safeJsonParse(v, fallback){
  try{
    const x = JSON.parse(String(v || ""));
    return x ?? fallback;
  }catch{
    return fallback;
  }
}

export async function markMapDirty(env, kind, localId, patch = {}){
  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO blogspot_post_map (
      local_id,
      remote_id,
      kind,
      title,
      slug,
      remote_updated,
      last_synced_at,
      last_pushed_at,
      dirty,
      deleted_local,
      deleted_remote
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(local_id) DO UPDATE SET
      kind = excluded.kind,
      title = COALESCE(excluded.title, blogspot_post_map.title),
      slug = COALESCE(excluded.slug, blogspot_post_map.slug),
      dirty = excluded.dirty,
      deleted_local = excluded.deleted_local,
      deleted_remote = excluded.deleted_remote
  `).bind(
    String(localId),
    String(patch.remote_id || ""),
    String(kind),
    patch.title || null,
    patch.slug || null,
    null,
    patch.last_synced_at || null,
    patch.last_pushed_at || null,
    patch.dirty ? 1 : 0,
    patch.deleted_local ? 1 : 0,
    patch.deleted_remote ? 1 : 0
  ).run();

  await env.DB.prepare(`
    INSERT INTO blogspot_sync_logs (
      id, direction, kind, local_id, remote_id, action, status, message, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    makeId("bslog"),
    "local",
    String(kind),
    String(localId),
    patch.remote_id || null,
    String(patch.action || "update"),
    "ok",
    String(patch.message || "local content marked dirty"),
    JSON.stringify(patch.payload_json || {}),
    now
  ).run();
}

export async function getSyncConfig(env){
  const rows = await env.DB.prepare(`
    SELECT k, v
    FROM blogspot_sync_config
  `).all();

  const by = Object.fromEntries((rows.results || []).map(x => [String(x.k), String(x.v || "")]));
  return {
    enabled: by.enabled || "0",
    auto_sync_enabled: by.auto_sync_enabled || "0",
    sync_interval_min: by.sync_interval_min || "15",
    sync_posts_enabled: by.sync_posts_enabled || "1",
    sync_pages_enabled: by.sync_pages_enabled || "1",
    sync_widgets_enabled: by.sync_widgets_enabled || "1",
    sync_direction: by.sync_direction || "bidirectional",
    cron_driver: by.cron_driver || "cron_trigger",
    cron_endpoint: by.cron_endpoint || "",
    cron_secret: by.cron_secret || ""
  };
}

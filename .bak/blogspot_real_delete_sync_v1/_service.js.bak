import { json, requireAuth, hasRole, nowSec } from "../../../_lib.js";

export async function getKV(env, k){
  const row = await env.DB.prepare(
    "SELECT v FROM system_settings WHERE k=? LIMIT 1"
  ).bind(k).first();
  return row ? String(row.v || "") : "";
}

export async function setKV(env, k, v, isSecret = 0){
  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, is_secret, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      is_secret = excluded.is_secret,
      updated_at = excluded.updated_at
  `).bind(k, String(v ?? ""), isSecret ? 1 : 0, nowSec()).run();
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

export async function getBlogspotOAuthConfig(env){
  const enabled = await getKV(env, "blogspot_oauth_enabled");
  const client_id = await getKV(env, "blogspot_client_id");
  const client_secret = await getKV(env, "blogspot_client_secret");
  const refresh_token = await getKV(env, "blogspot_refresh_token");
  const access_token = await getKV(env, "blogspot_access_token");
  const token_exp_at = await getKV(env, "blogspot_token_exp_at");

  return {
    enabled: enabled === "1",
    client_id,
    client_secret,
    refresh_token,
    access_token,
    token_exp_at: Number(token_exp_at || "0"),
    client_id_configured: !!client_id,
    client_secret_configured: !!client_secret,
    refresh_token_configured: !!refresh_token,
    access_token_configured: !!access_token
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

export async function bloggerFetch(url, opt = {}){
  try{
    const res = await fetch(url, {
      method: opt.method || "GET",
      headers: {
        "accept": "application/json",
        ...(opt.headers || {})
      },
      body: opt.body
    });

    const ct = res.headers.get("content-type") || "";

    if(ct.includes("application/json")){
      const data = await res.json().catch(() => null);
      return {
        ok: res.ok,
        status: res.status,
        data,
        text: ""
      };
    }

    const text = await res.text().catch(() => "");
    return {
      ok: res.ok,
      status: res.status,
      data: null,
      text: text.slice(0, 2000)
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
      remote_id = CASE
        WHEN excluded.remote_id IS NOT NULL AND excluded.remote_id <> '' THEN excluded.remote_id
        ELSE blogspot_post_map.remote_id
      END,
      kind = excluded.kind,
      title = COALESCE(excluded.title, blogspot_post_map.title),
      slug = COALESCE(excluded.slug, blogspot_post_map.slug),
      remote_updated = COALESCE(excluded.remote_updated, blogspot_post_map.remote_updated),
      last_synced_at = COALESCE(excluded.last_synced_at, blogspot_post_map.last_synced_at),
      last_pushed_at = COALESCE(excluded.last_pushed_at, blogspot_post_map.last_pushed_at),
      dirty = excluded.dirty,
      deleted_local = excluded.deleted_local,
      deleted_remote = excluded.deleted_remote
  `).bind(
    String(localId),
    String(patch.remote_id || ""),
    String(kind),
    patch.title || null,
    patch.slug || null,
    patch.remote_updated || null,
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
    String(patch.direction || "local"),
    String(kind),
    String(localId),
    patch.remote_id || null,
    String(patch.action || "update"),
    String(patch.status || "ok"),
    String(patch.message || "map updated"),
    JSON.stringify(patch.payload_json || {}),
    now
  ).run();
}

export function getOAuthRedirectUri(request){
  const u = new URL(request.url);
  return u.origin + "/api/blogspot/oauth_callback";
}

export async function exchangeAuthCodeForToken(request, env, code){
  const oauth = await getBlogspotOAuthConfig(env);
  const redirect_uri = getOAuthRedirectUri(request);

  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", String(code || ""));
  form.set("client_id", oauth.client_id || "");
  form.set("client_secret", oauth.client_secret || "");
  form.set("redirect_uri", redirect_uri);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });

  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function refreshBlogspotAccessToken(env){
  const oauth = await getBlogspotOAuthConfig(env);
  if(!oauth.enabled) return { ok:false, status:400, error:"oauth_disabled" };
  if(!oauth.client_id || !oauth.client_secret || !oauth.refresh_token){
    return { ok:false, status:400, error:"oauth_not_configured" };
  }

  const now = nowSec();
  if(oauth.access_token && oauth.token_exp_at > now + 60){
    return { ok:true, access_token: oauth.access_token, token_exp_at: oauth.token_exp_at };
  }

  const form = new URLSearchParams();
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", oauth.refresh_token);
  form.set("client_id", oauth.client_id);
  form.set("client_secret", oauth.client_secret);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });

  const data = await res.json().catch(() => null);
  if(!res.ok || !data?.access_token){
    return {
      ok: false,
      status: res.status,
      error: "token_refresh_failed",
      data
    };
  }

  const exp = now + Number(data.expires_in || 3600);
  await setKV(env, "blogspot_access_token", data.access_token, 1);
  await setKV(env, "blogspot_token_exp_at", String(exp), 1);

  return {
    ok: true,
    access_token: data.access_token,
    token_exp_at: exp
  };
}

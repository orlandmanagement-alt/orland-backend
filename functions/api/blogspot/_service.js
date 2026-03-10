import { json } from "../../_lib.js";

async function getKV(env, k){
  const row = await env.DB.prepare(
    "SELECT v FROM system_settings WHERE k=? LIMIT 1"
  ).bind(k).first();
  return row ? String(row.v || "") : "";
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

export function missingConfig(){
  return json(200, "ok", {
    enabled: true,
    configured: false,
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
      headers: {
        "accept": "application/json"
      }
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
    return json(200, "ok", { enabled:false });
  }

  if(!cfg.blog_id || !cfg.api_key){
    return missingConfig();
  }

  const url = bloggerUrl(cfg.blog_id, endpoint, params, cfg.api_key);
  const r = await bloggerFetch(url);

  if(!r.ok){
    return upstreamError(r.status, r.data || r.text || "");
  }

  return json(200, "ok", r.data);
}

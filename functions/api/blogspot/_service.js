import { json } from "../../_lib.js";

async function getKV(env, k){
  const row = await env.DB.prepare(`SELECT v FROM system_settings WHERE k=? LIMIT 1`).bind(k).first();
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

export async function blogspotGet(env, path, params = {}){
  const cfg = await getBlogspotConfig(env);

  if(!cfg.enabled){
    return json(200, "ok", { enabled:false });
  }
  if(!cfg.blog_id || !cfg.api_key){
    return json(200, "ok", {
      enabled:true,
      configured:false,
      message:"missing_blogspot_config"
    });
  }

  const u = new URL("https://www.googleapis.com/blogger/v3/blogs/" + encodeURIComponent(cfg.blog_id) + path);
  u.searchParams.set("key", cfg.api_key);

  for(const [k,v] of Object.entries(params)){
    if(v !== undefined && v !== null && String(v) !== ""){
      u.searchParams.set(k, String(v));
    }
  }

  try{
    const res = await fetch(u.toString(), {
      method: "GET",
      headers: { "accept": "application/json" }
    });

    const ct = res.headers.get("content-type") || "";
    if(!ct.includes("application/json")){
      const t = await res.text().catch(()=> "");
      return json(502, "server_error", { http: res.status, body: t.slice(0,500) });
    }

    const data = await res.json();
    if(!res.ok){
      return json(res.status, "server_error", { http: res.status, body: data });
    }

    return json(200, "ok", data);
  }catch(e){
    return json(500, "network_error", { message:String(e?.message || e) });
  }
}

import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function canAdmin(roles){ return hasRole(roles, ["super_admin","admin"]); }

async function getSetting(env, k){
  const r = await env.DB.prepare("SELECT k,v,is_secret,updated_at FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
  return r || null;
}
async function setSetting(env, k, v, is_secret){
  await env.DB.prepare(`
    INSERT INTO system_settings (k,v,is_secret,updated_at)
    VALUES (?,?,?,?)
    ON CONFLICT(k) DO UPDATE SET v=excluded.v, is_secret=excluded.is_secret, updated_at=excluded.updated_at
  `).bind(k, String(v||""), is_secret?1:0, nowSec()).run();
}

function mask(v){
  const s = String(v||"");
  if(!s) return "";
  if(s.length <= 6) return "******";
  return s.slice(0,2) + "******" + s.slice(-2);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const keys = [
    "blogspot_blog_id",
    "blogspot_client_id",
    "blogspot_client_secret",
    "blogspot_refresh_token",
    "blogspot_api_key"
  ];

  const out = {};
  for(const k of keys){
    const row = await getSetting(env,k);
    if(!row) out[k] = "";
    else out[k] = row.is_secret ? mask(row.v) : String(row.v||"");
  }

  const ok = !!(await getSetting(env,"blogspot_blog_id"));
  return json(200,"ok",{ connected: ok, settings: out });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canAdmin(a.roles)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const blog_id = String(body.blogspot_blog_id||"").trim();
  const client_id = String(body.blogspot_client_id||"").trim();
  const client_secret = String(body.blogspot_client_secret||"").trim();
  const refresh_token = String(body.blogspot_refresh_token||"").trim();
  const api_key = String(body.blogspot_api_key||"").trim();

  if(blog_id) await setSetting(env,"blogspot_blog_id", blog_id, false);
  if(client_id) await setSetting(env,"blogspot_client_id", client_id, true);
  if(client_secret) await setSetting(env,"blogspot_client_secret", client_secret, true);
  if(refresh_token) await setSetting(env,"blogspot_refresh_token", refresh_token, true);
  if(api_key) await setSetting(env,"blogspot_api_key", api_key, true);

  return json(200,"ok",{ saved:true });
}

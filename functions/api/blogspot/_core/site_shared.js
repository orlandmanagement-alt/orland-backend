import { nowSec } from "../../../_lib.js";

async function getSystemKV(env, k){
  try{
    const row = await env.DB.prepare(`
      SELECT v
      FROM system_settings
      WHERE k=?
      LIMIT 1
    `).bind(String(k || "")).first();
    return row ? String(row.v || "") : "";
  }catch{
    return "";
  }
}

async function setSystemKV(env, k, v){
  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, is_secret, updated_at)
    VALUES (?, ?, 0, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      updated_at = excluded.updated_at
  `).bind(String(k || ""), String(v || ""), now).run();
}

export async function getDefaultSiteId(env){
  return await getSystemKV(env, "blogspot_default_site_id");
}

export async function setDefaultSiteId(env, siteId){
  await setSystemKV(env, "blogspot_default_site_id", String(siteId || ""));
}

export async function listAllSites(env){
  const defaultSiteId = await getDefaultSiteId(env);

  const r = await env.DB.prepare(`
    SELECT
      id,
      account_id,
      blog_id,
      blog_name,
      blog_url,
      status,
      created_at,
      updated_at
    FROM blogspot_sites
    ORDER BY
      CASE WHEN id = ? THEN 0 ELSE 1 END ASC,
      CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC,
      updated_at DESC,
      created_at DESC
  `).bind(defaultSiteId || "").all();

  return (r.results || []).map(x => ({
    id: String(x.id || ""),
    account_id: String(x.account_id || ""),
    blog_id: String(x.blog_id || ""),
    blog_name: String(x.blog_name || ""),
    blog_url: String(x.blog_url || ""),
    status: String(x.status || "active"),
    created_at: Number(x.created_at || 0),
    updated_at: Number(x.updated_at || 0),
    is_default: String(x.id || "") === String(defaultSiteId || "") ? 1 : 0
  }));
}

export async function getSiteById(env, siteId){
  const row = await env.DB.prepare(`
    SELECT
      id,
      account_id,
      blog_id,
      blog_name,
      blog_url,
      status,
      created_at,
      updated_at
    FROM blogspot_sites
    WHERE id=?
    LIMIT 1
  `).bind(String(siteId || "")).first();

  if(!row) return null;

  const defaultSiteId = await getDefaultSiteId(env);

  return {
    id: String(row.id || ""),
    account_id: String(row.account_id || ""),
    blog_id: String(row.blog_id || ""),
    blog_name: String(row.blog_name || ""),
    blog_url: String(row.blog_url || ""),
    status: String(row.status || "active"),
    created_at: Number(row.created_at || 0),
    updated_at: Number(row.updated_at || 0),
    is_default: String(row.id || "") === String(defaultSiteId || "") ? 1 : 0
  };
}

export async function resolveActiveSite(env, requestedSiteId = ""){
  const want = String(requestedSiteId || "").trim();
  if(want){
    const site = await getSiteById(env, want);
    if(site) return site;
  }

  const defaultSiteId = await getDefaultSiteId(env);
  if(defaultSiteId){
    const site = await getSiteById(env, defaultSiteId);
    if(site) return site;
  }

  const r = await env.DB.prepare(`
    SELECT
      id,
      account_id,
      blog_id,
      blog_name,
      blog_url,
      status,
      created_at,
      updated_at
    FROM blogspot_sites
    WHERE status='active'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `).first();

  if(!r) return null;

  return {
    id: String(r.id || ""),
    account_id: String(r.account_id || ""),
    blog_id: String(r.blog_id || ""),
    blog_name: String(r.blog_name || ""),
    blog_url: String(r.blog_url || ""),
    status: String(r.status || "active"),
    created_at: Number(r.created_at || 0),
    updated_at: Number(r.updated_at || 0),
    is_default: String(r.id || "") === String(defaultSiteId || "") ? 1 : 0
  };
}

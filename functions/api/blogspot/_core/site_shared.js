import { nowSec } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";

export async function requireSiteAccess(env, request, allowStaff = true){
  return await requireBlogspotAccess(env, request, allowStaff);
}

export async function getSiteContext(env, k, fallback = ""){
  const row = await env.DB.prepare(`
    SELECT v FROM blogspot_site_context
    WHERE k=?
    LIMIT 1
  `).bind(String(k)).first();
  return row ? String(row.v || "") : String(fallback ?? "");
}

export async function setSiteContext(env, k, v){
  await env.DB.prepare(`
    INSERT INTO blogspot_site_context (k, v, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      updated_at = excluded.updated_at
  `).bind(String(k), String(v ?? ""), nowSec()).run();
}

export async function listSites(env){
  const r = await env.DB.prepare(`
    SELECT id, blog_id, blog_name, blog_url, status, is_default, created_at, updated_at
    FROM blogspot_sites
    ORDER BY is_default DESC, blog_name ASC, created_at ASC
  `).all();

  return (r.results || []).map(x => ({
    id: String(x.id || ""),
    blog_id: String(x.blog_id || ""),
    blog_name: String(x.blog_name || ""),
    blog_url: String(x.blog_url || ""),
    status: String(x.status || "active"),
    is_default: Number(x.is_default || 0),
    created_at: Number(x.created_at || 0),
    updated_at: Number(x.updated_at || 0)
  }));
}

export async function resolveActiveSite(env, requestedSiteId = ""){
  const explicit = String(requestedSiteId || "").trim();
  if(explicit){
    const row = await env.DB.prepare(`
      SELECT id, blog_id, blog_name, blog_url, status, is_default
      FROM blogspot_sites
      WHERE id=? AND status='active'
      LIMIT 1
    `).bind(explicit).first();
    if(row) return row;
  }

  const ctx = await getSiteContext(env, "active_site_id", "");
  if(ctx){
    const row = await env.DB.prepare(`
      SELECT id, blog_id, blog_name, blog_url, status, is_default
      FROM blogspot_sites
      WHERE id=? AND status='active'
      LIMIT 1
    `).bind(ctx).first();
    if(row) return row;
  }

  return await env.DB.prepare(`
    SELECT id, blog_id, blog_name, blog_url, status, is_default
    FROM blogspot_sites
    WHERE status='active'
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1
  `).first();
}

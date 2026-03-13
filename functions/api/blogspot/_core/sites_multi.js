import { json, readJson, nowSec } from "../../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotConfig,
  bloggerUrl,
  bloggerFetch
} from "./_service.js";
import {
  listAllSites,
  getSiteById,
  setDefaultSiteId,
  getDefaultSiteId
} from "./site_shared.js";

function s(v){ return String(v || "").trim(); }

function cleanStatus(v){
  const x = s(v).toLowerCase();
  return ["active", "inactive"].includes(x) ? x : "active";
}

async function existsById(env, id){
  const row = await env.DB.prepare(`
    SELECT id
    FROM blogspot_sites
    WHERE id=?
    LIMIT 1
  `).bind(id).first();
  return !!row;
}

async function existsConflict(env, { id = "", blog_id = "", blog_url = "" }){
  const row = await env.DB.prepare(`
    SELECT id
    FROM blogspot_sites
    WHERE (blog_id = ? OR (blog_url <> '' AND blog_url = ?))
      AND id <> ?
    LIMIT 1
  `).bind(String(blog_id || ""), String(blog_url || ""), String(id || "")).first();

  return row ? String(row.id || "") : "";
}

async function testSiteConnection(env, site){
  const cfg = await getBlogspotConfig(env);
  if(!cfg.enabled || !cfg.api_key){
    return {
      ok: false,
      error: "blogspot_api_key_missing"
    };
  }

  if(!site?.blog_id){
    return {
      ok: false,
      error: "blog_id_required"
    };
  }

  const url = bloggerUrl(site.blog_id, "", {}, cfg.api_key);
  const res = await bloggerFetch(url, { method:"GET" });

  if(!res.ok){
    return {
      ok: false,
      error: "upstream_error",
      http: Number(res.status || 502),
      body: res.data || res.text || ""
    };
  }

  const blog = res.data || {};
  return {
    ok: true,
    blog: {
      id: String(blog.id || ""),
      name: String(blog.name || ""),
      url: String(blog.url || "")
    }
  };
}

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const id = s(url.searchParams.get("id"));
  const mode = s(url.searchParams.get("mode")).toLowerCase();

  if(mode === "default"){
    const defaultSiteId = await getDefaultSiteId(env);
    return json(200, "ok", {
      default_site_id: defaultSiteId || ""
    });
  }

  if(id){
    const item = await getSiteById(env, id);
    if(!item) return json(404, "not_found", { error:"site_not_found" });
    return json(200, "ok", { item });
  }

  const items = await listAllSites(env);
  return json(200, "ok", {
    items,
    total: items.length
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const action = s(body.action || "create").toLowerCase();
  const now = nowSec();

  if(action === "test_connection"){
    const site = body.site_id
      ? await getSiteById(env, s(body.site_id))
      : {
          id: s(body.id),
          account_id: s(body.account_id),
          blog_id: s(body.blog_id),
          blog_name: s(body.blog_name),
          blog_url: s(body.blog_url),
          status: cleanStatus(body.status)
        };

    if(!site) return json(404, "not_found", { error:"site_not_found" });

    const tested = await testSiteConnection(env, site);
    return json(200, "ok", tested);
  }

  if(action === "set_default"){
    const site_id = s(body.site_id);
    if(!site_id) return json(400, "invalid_input", { error:"site_id_required" });

    const site = await getSiteById(env, site_id);
    if(!site) return json(404, "not_found", { error:"site_not_found" });

    await setDefaultSiteId(env, site_id);

    return json(200, "ok", {
      saved: true,
      default_site_id: site_id
    });
  }

  if(action === "delete"){
    const id = s(body.id);
    if(!id) return json(400, "invalid_input", { error:"id_required" });

    const site = await getSiteById(env, id);
    if(!site) return json(404, "not_found", { error:"site_not_found" });

    const defaultSiteId = await getDefaultSiteId(env);
    if(String(defaultSiteId || "") === String(id)){
      return json(400, "invalid_input", { error:"default_site_delete_denied" });
    }

    await env.DB.prepare(`
      DELETE FROM blogspot_sites
      WHERE id=?
    `).bind(id).run();

    return json(200, "ok", {
      deleted: true,
      id
    });
  }

  const id = s(body.id);
  const account_id = s(body.account_id);
  const blog_id = s(body.blog_id);
  const blog_name = s(body.blog_name);
  const blog_url = s(body.blog_url);
  const status = cleanStatus(body.status);

  if(!id || !account_id || !blog_id || !blog_name){
    return json(400, "invalid_input", {
      error: "id_account_blogid_blogname_required"
    });
  }

  if(!/^[a-zA-Z0-9_\-]+$/.test(id)){
    return json(400, "invalid_input", { error:"id_invalid" });
  }

  const conflictId = await existsConflict(env, { id, blog_id, blog_url });
  if(conflictId){
    return json(400, "invalid_input", {
      error: "site_conflict_blog_id_or_url",
      conflict_id: conflictId
    });
  }

  if(action === "create"){
    if(await existsById(env, id)){
      return json(400, "invalid_input", { error:"site_id_exists" });
    }

    await env.DB.prepare(`
      INSERT INTO blogspot_sites (
        id, account_id, blog_id, blog_name, blog_url, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      account_id,
      blog_id,
      blog_name,
      blog_url || null,
      status,
      now,
      now
    ).run();

    if(body.set_as_default === true){
      await setDefaultSiteId(env, id);
    }

    return json(200, "ok", {
      created: true,
      id
    });
  }

  if(action === "update"){
    const exists = await getSiteById(env, id);
    if(!exists) return json(404, "not_found", { error:"site_not_found" });

    await env.DB.prepare(`
      UPDATE blogspot_sites
      SET account_id=?,
          blog_id=?,
          blog_name=?,
          blog_url=?,
          status=?,
          updated_at=?
      WHERE id=?
    `).bind(
      account_id,
      blog_id,
      blog_name,
      blog_url || null,
      status,
      now,
      id
    ).run();

    if(body.set_as_default === true){
      await setDefaultSiteId(env, id);
    }

    return json(200, "ok", {
      updated: true,
      id
    });
  }

  return json(400, "invalid_input", { error:"invalid_action" });
}

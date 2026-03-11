import { json, readJson, nowSec } from "../../_lib.js";
import { requireBlogspotAccess, getBlogspotConfig, makeId, safeJsonParse } from "./_service.js";

function s(v){ return String(v || "").trim(); }
function n(v, d = 0){ const x = Number(v); return Number.isFinite(x) ? x : d; }

function sanitizeAdminHtml(input){
  let html = String(input || "");

  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  html = html.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "");
  html = html.replace(/<embed\b[^>]*>/gi, "");
  html = html.replace(/<link\b[^>]*>/gi, "");
  html = html.replace(/<meta\b[^>]*>/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  html = html.replace(/javascript:/gi, "");
  return html.trim();
}

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const cfg = await getBlogspotConfig(env);

  const widgetsR = await env.DB.prepare(`
    SELECT id, provider, account_id, widget_key, data_json, status, created_at, updated_at
    FROM cms_widgets
    WHERE provider = 'blogspot'
    ORDER BY updated_at DESC, created_at DESC
  `).all();

  const homeR = await env.DB.prepare(`
    SELECT id, section, title, payload_json, sort_order, status, updated_at
    FROM blogspot_widget_home
    ORDER BY sort_order ASC, updated_at DESC
  `).all();

  return json(200, "ok", {
    enabled: cfg.enabled,
    configured: !!(cfg.blog_id && cfg.api_key),
    items: (widgetsR.results || []).map(x => ({
      ...x,
      data_json: safeJsonParse(x.data_json, {})
    })),
    home_blocks: (homeR.results || []).map(x => ({
      ...x,
      payload_json: safeJsonParse(x.payload_json, {})
    })),
    note: "Widgets are local HTML blocks. Blogger public API does not provide widget CRUD."
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const action = s(body.action || "create").toLowerCase();
  const cfg = await getBlogspotConfig(env);
  const now = nowSec();

  if(action === "delete"){
    const id = s(body.id);
    if(!id) return json(400, "invalid_input", { error:"id_required" });
    await env.DB.prepare(`DELETE FROM cms_widgets WHERE id=?`).bind(id).run();
    return json(200, "ok", { deleted:true, id });
  }

  if(action === "home_delete"){
    const id = s(body.id);
    if(!id) return json(400, "invalid_input", { error:"id_required" });
    await env.DB.prepare(`DELETE FROM blogspot_widget_home WHERE id=?`).bind(id).run();
    return json(200, "ok", { deleted:true, id });
  }

  if(action === "home_upsert"){
    const id = s(body.id) || makeId("homeblk");
    const section = s(body.section || "main");
    const title = s(body.title || "Block");
    const html = sanitizeAdminHtml(body.html || "");
    const sort_order = n(body.sort_order, 0);
    const status = s(body.status || "active") || "active";

    const exists = await env.DB.prepare(`SELECT id FROM blogspot_widget_home WHERE id=? LIMIT 1`).bind(id).first();

    if(exists){
      await env.DB.prepare(`
        UPDATE blogspot_widget_home
        SET section=?, title=?, payload_json=?, sort_order=?, status=?, updated_at=?
        WHERE id=?
      `).bind(
        section,
        title,
        JSON.stringify({ html }),
        sort_order,
        status,
        now,
        id
      ).run();
    }else{
      await env.DB.prepare(`
        INSERT INTO blogspot_widget_home (
          id, section, title, payload_json, sort_order, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        section,
        title,
        JSON.stringify({ html }),
        sort_order,
        status,
        now
      ).run();
    }

    return json(200, "ok", { saved:true, id, kind:"home_block" });
  }

  const id = action === "update" ? s(body.id) : (s(body.id) || makeId("widget"));
  if(!id) return json(400, "invalid_input", { error:"id_required" });

  const widget_key = s(body.widget_key || id);
  const title = s(body.title || widget_key);
  const html = sanitizeAdminHtml(body.html || "");
  const section = s(body.section || "main");
  const status = s(body.status || "active") || "active";
  const exists = await env.DB.prepare(`SELECT id FROM cms_widgets WHERE id=? LIMIT 1`).bind(id).first();

  if(action === "update"){
    if(!exists) return json(404, "not_found", { error:"widget_not_found" });

    await env.DB.prepare(`
      UPDATE cms_widgets
      SET provider=?, account_id=?, widget_key=?, data_json=?, status=?, updated_at=?
      WHERE id=?
    `).bind(
      "blogspot",
      cfg.blog_id || "local",
      widget_key,
      JSON.stringify({ title, html, section }),
      status,
      now,
      id
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO cms_widgets (
        id, provider, account_id, widget_key, data_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      "blogspot",
      cfg.blog_id || "local",
      widget_key,
      JSON.stringify({ title, html, section }),
      status,
      now,
      now
    ).run();
  }

  return json(200, "ok", { saved:true, id, kind:"widget" });
}

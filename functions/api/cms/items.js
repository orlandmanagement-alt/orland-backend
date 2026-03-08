import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin"]); }
const ACCOUNT_ID = "blogspot_global";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const kind = String(url.searchParams.get("kind") || "post");
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));

  const like = q ? `%${q}%` : null;

  const r = await env.DB.prepare(`
    SELECT id,account_id,kind,external_id,title,slug,status,published_at,created_at,updated_at
    FROM cms_items
    WHERE account_id=? AND kind=? AND ( ? IS NULL OR lower(title) LIKE ? OR lower(slug) LIKE ? )
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(ACCOUNT_ID, kind, like, like, like, limit).all();

  return json(200,"ok",{ items: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id || "").trim() || crypto.randomUUID();
  const kind = String(body.kind || "post").trim();
  const title = String(body.title || "").trim();
  const slug = String(body.slug || "").trim() || null;
  const content_html = String(body.content_html || "").trim() || null;
  const status = String(body.status || "draft").trim();
  const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
  const meta_json = JSON.stringify(meta);

  if(!title) return json(400,"invalid_input",{ message:"title_required" });
  if(kind !== "post" && kind !== "page") return json(400,"invalid_input",{ message:"kind_invalid" });

  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO cms_items
      (id,account_id,kind,external_id,title,slug,content_html,meta_json,status,published_at,created_at,updated_at)
    VALUES
      (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      slug=excluded.slug,
      content_html=excluded.content_html,
      meta_json=excluded.meta_json,
      status=excluded.status,
      updated_at=excluded.updated_at
  `).bind(
    id, ACCOUNT_ID, kind, null, title, slug, content_html, meta_json, status, null, now, now
  ).run();

  return json(200,"ok",{ saved:true, id });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if(!id) return json(400,"invalid_input",{ message:"id_required" });

  await env.DB.prepare("DELETE FROM cms_items WHERE id=?").bind(id).run();
  return json(200,"ok",{ deleted:true });
}

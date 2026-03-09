import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

const PROVIDER = "blogspot";
const ACCOUNT_ID = "blogspot_global";

function mustStaff(a){
  return hasRole(a.roles, ["super_admin","admin","staff"]);
}
function mustAdmin(a){
  return hasRole(a.roles, ["super_admin","admin"]);
}
function normKind(k){
  k = String(k||"").trim().toLowerCase();
  return (k==="page") ? "page" : "post";
}
function normSlug(s){
  s = String(s||"").trim().toLowerCase();
  s = s.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  return s || null;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!mustStaff(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const kind = normKind(url.searchParams.get("kind"));
  const q = String(url.searchParams.get("q")||"").trim().toLowerCase();
  const status = String(url.searchParams.get("status")||"").trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));

  const like = q ? `%${q}%` : null;

  const rows = await env.DB.prepare(`
    SELECT id,provider,account_id,kind,external_id,title,slug,content_html,meta_json,status,published_at,created_at,updated_at
    FROM cms_items
    WHERE provider=? AND account_id=? AND kind=?
      AND ( ? IS NULL OR lower(title) LIKE ? OR lower(slug) LIKE ? )
      AND ( ? = '' OR lower(status)=? )
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(PROVIDER, ACCOUNT_ID, kind, like, like, like, status, status, limit).all();

  return json(200,"ok",{ items: rows.results||[], kind });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!mustAdmin(a)) return json(403,"forbidden",null);

  const body = (await readJson(request)) || {};
  const id = String(body.id||"").trim() || crypto.randomUUID();
  const kind = normKind(body.kind);
  const title = String(body.title||"").trim();
  const slug = normSlug(body.slug || title);
  const content_html = String(body.content_html||"");
  const meta = body.meta_json ?? body.meta ?? {};
  const meta_json = typeof meta === "string" ? meta : JSON.stringify(meta||{});
  const status = String(body.status||"draft").trim().toLowerCase();
  const published_at = body.published_at ? Number(body.published_at) : null;

  if(!title) return json(400,"invalid_input",{message:"title_required"});

  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO cms_items
      (id,provider,account_id,kind,external_id,title,slug,content_html,meta_json,status,published_at,created_at,updated_at)
    VALUES
      (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      slug=excluded.slug,
      content_html=excluded.content_html,
      meta_json=excluded.meta_json,
      status=excluded.status,
      published_at=excluded.published_at,
      updated_at=excluded.updated_at
  `).bind(id, PROVIDER, ACCOUNT_ID, kind, null, title, slug, content_html, meta_json, status, published_at, now, now).run();

  return json(200,"ok",{ saved:true, id, kind });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!mustAdmin(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  await env.DB.prepare(`DELETE FROM cms_items WHERE id=? AND provider=? AND account_id=?`).bind(id, PROVIDER, ACCOUNT_ID).run();
  return json(200,"ok",{ deleted:true, id });
}

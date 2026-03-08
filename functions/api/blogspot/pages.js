import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";
function canWrite(roles){ return hasRole(roles, ["super_admin","admin"]); }
function canRead(roles){ return hasRole(roles, ["super_admin","admin","staff"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request); if(!a.ok) return a.res;
  if(!canRead(a.roles)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q")||"").trim().toLowerCase();
  const status = (url.searchParams.get("status")||"").trim();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));
  const like = q ? `%${q}%` : null;

  const r = await env.DB.prepare(`
    SELECT id,title,slug,status,created_at,updated_at,created_by_user_id,updated_by_user_id
    FROM cms_pages
    WHERE ( ? IS NULL OR lower(title) LIKE ? OR lower(slug) LIKE ? )
      AND ( ? = '' OR status = ? )
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(like, like, like, status, status, limit).all();

  return json(200,"ok",{ pages: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request); if(!a.ok) return a.res;
  if(!canWrite(a.roles)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body.id||"").trim();
  const title = String(body.title||"").trim();
  const slug = String(body.slug||"").trim();
  const status = String(body.status||"draft").trim();
  const content = String(body.body||"");

  if(!title) return json(400,"invalid_input",{message:"title"});
  if(!["draft","published","archived"].includes(status)) return json(400,"invalid_input",{message:"status"});

  const now = nowSec();
  const pid = id || crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO cms_pages (id,title,slug,status,body,meta_json,created_by_user_id,updated_by_user_id,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      slug=excluded.slug,
      status=excluded.status,
      body=excluded.body,
      updated_by_user_id=excluded.updated_by_user_id,
      updated_at=excluded.updated_at
  `).bind(
    pid, title, slug||null, status,
    content,
    "{}",
    a.uid, a.uid, now, now
  ).run();

  return json(200,"ok",{ saved:true, id: pid });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request); if(!a.ok) return a.res;
  if(!canWrite(a.roles)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",null);

  await env.DB.prepare("DELETE FROM cms_pages WHERE id=?").bind(id).run();
  return json(200,"ok",{ deleted:true });
}

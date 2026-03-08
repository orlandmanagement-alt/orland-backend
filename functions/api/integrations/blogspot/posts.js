import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../../_lib.js";

const PROVIDER="blogspot";
const ACCOUNT_ID="blogspot_global";
const KIND="post";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a=await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const url=new URL(request.url);
  const q=(url.searchParams.get("q")||"").trim().toLowerCase();
  const status=(url.searchParams.get("status")||"").trim().toLowerCase(); // draft|published
  const limit=Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));

  const like=q?`%${q}%`:null;
  const st=status?status:null;

  const r=await env.DB.prepare(`
    SELECT id,external_id,title,slug,status,published_at,created_at,updated_at
    FROM cms_items
    WHERE provider=? AND account_id=? AND kind=?
      AND ( ? IS NULL OR title LIKE ? OR slug LIKE ? )
      AND ( ? IS NULL OR status=? )
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(PROVIDER,ACCOUNT_ID,KIND, like, like, like, st, st, limit).all();

  return json(200,"ok",{ rows:r.results||[] });
}

export async function onRequestPost({ request, env }){
  const a=await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body=await readJson(request)||{};
  const title=String(body.title||"").trim();
  const slug=String(body.slug||"").trim() || null;
  const content_html=body.content_html!=null ? String(body.content_html) : null;
  const status=String(body.status||"draft").trim().toLowerCase();
  const meta=body.meta_json ?? body.meta ?? {};

  if(!title) return json(400,"invalid_input",{message:"title_required"});

  const now=nowSec();
  const id=crypto.randomUUID();
  const published_at = (status==="published") ? now : null;

  await env.DB.prepare(`
    INSERT INTO cms_items (id,provider,account_id,kind,external_id,title,slug,content_html,meta_json,status,published_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,PROVIDER,ACCOUNT_ID,KIND,
    null,title,slug,content_html,
    JSON.stringify(meta||{}),
    (status==="published"?"published":"draft"),
    published_at,
    now,now
  ).run();

  await audit(env,{ actor_user_id:a.uid, action:"blogspot.posts.create", route:"POST /api/integrations/blogspot/posts", http_status:200, meta:{ id } });
  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a=await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body=await readJson(request)||{};
  const id=String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  const row=await env.DB.prepare(`
    SELECT id,status,published_at
    FROM cms_items
    WHERE id=? AND provider=? AND account_id=? AND kind=?
    LIMIT 1
  `).bind(id,PROVIDER,ACCOUNT_ID,KIND).first();
  if(!row) return json(404,"not_found",null);

  const title = body.title!=null ? String(body.title).trim() : null;
  const slug = body.slug!=null ? (String(body.slug).trim()||null) : undefined;
  const content_html = body.content_html!=null ? String(body.content_html) : undefined;
  const status = body.status!=null ? String(body.status).trim().toLowerCase() : undefined;
  const meta = body.meta_json ?? body.meta;

  const now=nowSec();
  let nextPublishedAt = row.published_at;

  let nextStatus = undefined;
  if(status !== undefined){
    nextStatus = (status==="published"?"published":"draft");
    if(nextStatus==="published" && !row.published_at) nextPublishedAt = now;
    if(nextStatus==="draft") nextPublishedAt = null;
  }

  // partial update via COALESCE pattern
  await env.DB.prepare(`
    UPDATE cms_items
    SET
      title = COALESCE(?, title),
      slug = CASE WHEN ? IS NULL THEN slug ELSE ? END,
      content_html = CASE WHEN ? IS NULL THEN content_html ELSE ? END,
      meta_json = CASE WHEN ? IS NULL THEN meta_json ELSE ? END,
      status = COALESCE(?, status),
      published_at = ?,
      updated_at = ?
    WHERE id=? AND provider=? AND account_id=? AND kind=?
  `).bind(
    title,
    slug===undefined?null:slug, slug===undefined?null:slug,
    content_html===undefined?null:content_html, content_html===undefined?null:content_html,
    meta===undefined?null:JSON.stringify(meta||{}), meta===undefined?null:JSON.stringify(meta||{}),
    nextStatus,
    nextPublishedAt,
    now,
    id,PROVIDER,ACCOUNT_ID,KIND
  ).run();

  await audit(env,{ actor_user_id:a.uid, action:"blogspot.posts.update", route:"PUT /api/integrations/blogspot/posts", http_status:200, meta:{ id } });
  return json(200,"ok",{ updated:true });
}

export async function onRequestDelete({ request, env }){
  const a=await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",{message:"super_admin_only"});

  const url=new URL(request.url);
  const id=String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  await env.DB.prepare(`DELETE FROM cms_items WHERE id=? AND provider=? AND account_id=? AND kind=?`)
    .bind(id,PROVIDER,ACCOUNT_ID,KIND).run();

  await audit(env,{ actor_user_id:a.uid, action:"blogspot.posts.delete", route:"DELETE /api/integrations/blogspot/posts", http_status:200, meta:{ id } });
  return json(200,"ok",{ deleted:true });
}

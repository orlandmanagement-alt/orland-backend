import { json, readJson, requireAuth, hasRole, nowSec, audit } from "../../../_lib.js";

const PROVIDER="blogspot";
const ACCOUNT_ID="blogspot_global";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a=await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const r=await env.DB.prepare(`
    SELECT id,widget_key,data_json,status,created_at,updated_at
    FROM cms_widgets
    WHERE provider=? AND account_id=?
    ORDER BY updated_at DESC
    LIMIT 200
  `).bind(PROVIDER,ACCOUNT_ID).all();

  return json(200,"ok",{ rows:r.results||[] });
}

export async function onRequestPost({ request, env }){
  const a=await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body=await readJson(request)||{};
  const widget_key=String(body.widget_key||"").trim();
  const data=body.data_json ?? body.data ?? {};
  const status=String(body.status||"active").trim().toLowerCase();

  if(!widget_key) return json(400,"invalid_input",{message:"widget_key_required"});

  const now=nowSec();
  const existing=await env.DB.prepare(`
    SELECT id FROM cms_widgets WHERE provider=? AND account_id=? AND widget_key=? LIMIT 1
  `).bind(PROVIDER,ACCOUNT_ID,widget_key).first();

  if(existing){
    await env.DB.prepare(`
      UPDATE cms_widgets
      SET data_json=?, status=?, updated_at=?
      WHERE id=?
    `).bind(JSON.stringify(data||{}),(status==="active"?"active":"inactive"),now,existing.id).run();
    await audit(env,{ actor_user_id:a.uid, action:"blogspot.widgets.upsert", route:"POST /api/integrations/blogspot/widgets", http_status:200, meta:{ widget_key } });
    return json(200,"ok",{ saved:true, id: existing.id });
  }

  const id=crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO cms_widgets (id,provider,account_id,widget_key,data_json,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(id,PROVIDER,ACCOUNT_ID,widget_key,JSON.stringify(data||{}),(status==="active"?"active":"inactive"),now,now).run();

  await audit(env,{ actor_user_id:a.uid, action:"blogspot.widgets.create", route:"POST /api/integrations/blogspot/widgets", http_status:200, meta:{ widget_key } });
  return json(200,"ok",{ saved:true, id });
}

export async function onRequestDelete({ request, env }){
  const a=await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",{message:"super_admin_only"});

  const url=new URL(request.url);
  const id=String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  await env.DB.prepare(`DELETE FROM cms_widgets WHERE id=? AND provider=? AND account_id=?`).bind(id,PROVIDER,ACCOUNT_ID).run();
  await audit(env,{ actor_user_id:a.uid, action:"blogspot.widgets.delete", route:"DELETE /api/integrations/blogspot/widgets", http_status:200, meta:{ id } });
  return json(200,"ok",{ deleted:true });
}

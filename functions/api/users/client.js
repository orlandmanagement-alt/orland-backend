import { json, requireAuth, hasRole } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

function b64e(s){
  const u = new TextEncoder().encode(String(s));
  let bin=""; for(const c of u) bin += String.fromCharCode(c);
  return btoa(bin).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function b64d(s){
  s = String(s||"").replaceAll("-","+").replaceAll("_","/");
  while(s.length%4) s += "=";
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(u8);
}
function parseCursor(cur){
  if(!cur) return null;
  try{
    const j = JSON.parse(b64d(cur));
    const created_at = Number(j.created_at||0);
    const id = String(j.id||"");
    if(!created_at || !id) return null;
    return { created_at, id };
  }catch{ return null; }
}
function makeCursor(row){
  return b64e(JSON.stringify({ created_at:Number(row.created_at||0), id:String(row.id||"") }));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q")||"").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||"50")));
  const cur = parseCursor(url.searchParams.get("cursor"));
  const like = q ? `%${q}%` : null;

  // list users with role 'client' only
  const rows = await env.DB.prepare(`
    SELECT u.id,u.email_norm,u.display_name,u.status,u.created_at,u.updated_at
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles r ON r.id=ur.role_id
    WHERE r.name='client'
      AND ( ? IS NULL OR lower(u.email_norm) LIKE ? OR lower(u.display_name) LIKE ? )
      AND (
        ? IS NULL
        OR (u.created_at < ?)
        OR (u.created_at = ? AND u.id < ?)
      )
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT ?
  `).bind(
    like, like, like,
    cur ? "1" : null,
    cur ? cur.created_at : null,
    cur ? cur.created_at : null,
    cur ? cur.id : null,
    limit + 1
  ).all();

  const list = rows.results || [];
  const hasMore = list.length > limit;
  const page = hasMore ? list.slice(0, limit) : list;
  const next_cursor = hasMore ? makeCursor(page[page.length-1]) : null;

  return json(200,"ok",{ rows: page, next_cursor });
}

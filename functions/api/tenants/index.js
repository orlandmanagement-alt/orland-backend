import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

function b64e(s){
  const u = new TextEncoder().encode(String(s));
  let bin = ""; for(const c of u) bin += String.fromCharCode(c);
  return btoa(bin).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function b64d(s){
  s = String(s||"").replaceAll("-","+").replaceAll("_","/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
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
  return b64e(JSON.stringify({ created_at: Number(row.updated_at||row.created_at||0), id: String(row.id||"") }));
}

// GET /api/tenants?q=&limit=&cursor=
export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q")||"").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||"50")));
  const cur = parseCursor(url.searchParams.get("cursor"));
  const like = q ? `%${q}%` : null;

  // cursor-based pagination (stable)
  // use updated_at then id as tie-break
  const rows = await env.DB.prepare(`
    SELECT id,name,status,created_at,updated_at
    FROM tenants
    WHERE
      ( ? IS NULL OR lower(name) LIKE ? OR lower(id) LIKE ? )
      AND (
        ? IS NULL
        OR (updated_at < ?)
        OR (updated_at = ? AND id < ?)
      )
    ORDER BY updated_at DESC, id DESC
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

  return json(200,"ok",{
    rows: page,
    next_cursor
  });
}

// POST /api/tenants { id?, name }
export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const name = String(body.name||"").trim();
  let id = String(body.id||"").trim();

  if(!name) return json(400,"invalid_input",{message:"name_required"});

  const now = nowSec();

  if(!id){
    id = crypto.randomUUID();
  }

  // upsert
  await env.DB.prepare(`
    INSERT INTO tenants (id,name,status,created_at,updated_at)
    VALUES (?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      updated_at=excluded.updated_at
  `).bind(id, name, "active", now, now).run();

  return json(200,"ok",{ id, created:true });
}

// PUT /api/tenants { action, id, name? }
export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action||"").trim();
  const id = String(body.id||"").trim();
  const now = nowSec();

  if(!id) return json(400,"invalid_input",{message:"id_required"});

  if(action === "rename"){
    const name = String(body.name||"").trim();
    if(!name) return json(400,"invalid_input",{message:"name_required"});
    await env.DB.prepare("UPDATE tenants SET name=?, updated_at=? WHERE id=?").bind(name, now, id).run();
    return json(200,"ok",{ updated:true });
  }

  if(action === "disable" || action === "enable"){
    const st = action === "disable" ? "disabled" : "active";
    await env.DB.prepare("UPDATE tenants SET status=?, updated_at=? WHERE id=?").bind(st, now, id).run();
    return json(200,"ok",{ updated:true });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}

// DELETE /api/tenants?id=
export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",{message:"super_admin_only"});

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id_required"});

  await env.DB.prepare("DELETE FROM tenants WHERE id=?").bind(id).run();
  return json(200,"ok",{ deleted:true });
}

import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));
  const status = String(url.searchParams.get("status")||"").trim();

  let q = `SELECT id,type,payload_json,status,attempts,run_at,created_at,updated_at,last_error
           FROM tasks `;
  const bind = [];
  if(status){
    q += `WHERE status=? `;
    bind.push(status);
  }
  q += `ORDER BY run_at ASC, created_at DESC LIMIT ?`;
  bind.push(limit);

  const r = await env.DB.prepare(q).bind(...bind).all();
  const rows = (r.results||[]).map(x=>({
    ...x,
    payload: safeJson(x.payload_json),
  }));
  return json(200,"ok",{ rows });
}

function safeJson(s){
  try{ return JSON.parse(String(s||"{}")); }catch{ return {}; }
}

import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

// rate limit rules store in system_settings (same as policy.js)
// keys:
// sec_rl_login_limit, sec_rl_login_window_sec

async function getNum(env, k, def){
  try{
    const r = await env.DB.prepare("SELECT v FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
    if(!r || r.v==null) return def;
    const n = Number(r.v);
    return Number.isFinite(n) ? n : def;
  }catch{ return def; }
}

function ipPrefix(request){
  const cf = request.headers.get("cf-connecting-ip") || "";
  // we store hash in DB, but for display we just show raw IP here if needed later
  return cf || "unknown";
}

// helper: write ip_activity row (kind=rate_limited)
async function bumpIpActivity(env, kind, ip_hash){
  const now = nowSec();
  const window_start = now - (now % 300); // 5 min buckets for activity table
  const id = `${kind}:${window_start}:${ip_hash}`;
  await env.DB.prepare(`
    INSERT INTO ip_activity (id,ip_hash,kind,cnt,window_start,updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET cnt=cnt+1, updated_at=excluded.updated_at
  `).bind(id, ip_hash, kind, 1, window_start, now).run();
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const kind = String(body.kind || "login"); // reserved
  if(kind !== "login") return json(400,"invalid_input",{message:"kind"});

  const limit = await getNum(env, "sec_rl_login_limit", 20);
  const windowSec = await getNum(env, "sec_rl_login_window_sec", 300);
  return json(200,"ok",{ kind, limit, window_sec: windowSec });
}

// This endpoint is informational only for super_admin.
export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  // show top rate_limited in last 24h
  const since = nowSec() - 86400;
  const r = await env.DB.prepare(`
    SELECT ip_hash, SUM(cnt) AS total, MAX(updated_at) AS last_seen_at
    FROM ip_activity
    WHERE kind='rate_limited' AND window_start >= ?
    GROUP BY ip_hash
    ORDER BY total DESC
    LIMIT 50
  `).bind(since).all();

  return json(200,"ok",{ rows: r.results || [] });
}

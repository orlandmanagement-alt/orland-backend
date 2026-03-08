import { json, requireAuth, hasRole } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

function clamp(n, lo, hi){ n=Number(n); if(!Number.isFinite(n)) return null; return Math.max(lo, Math.min(hi, n)); }

function b64e(s){
  const u=new TextEncoder().encode(String(s));
  let bin=""; for(const c of u) bin+=String.fromCharCode(c);
  return btoa(bin).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function b64d(s){
  s=String(s||"").replaceAll("-","+").replaceAll("_","/");
  while(s.length%4) s+="=";
  const bin=atob(s);
  const u8=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(u8);
}
function parseCursor(cur){
  if(!cur) return null;
  try{
    const j=JSON.parse(b64d(cur));
    const score=Number(j.score||0);
    const id=String(j.id||"");
    if(!id) return null;
    return { score, id };
  }catch{ return null; }
}
function makeCursor(row){
  return b64e(JSON.stringify({ score:Number(row.score||0), id:String(row.user_id||row.id||"") }));
}

// GET /api/users/talent?loc=&gender=&age_min=&age_max=&h_min=&h_max=&cat=&score_min=&progress_min=&limit=&cursor=
export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);

  const loc = String(url.searchParams.get("loc")||"").trim().toLowerCase();
  const gender = String(url.searchParams.get("gender")||"").trim();
  const cat = String(url.searchParams.get("cat")||"").trim().toLowerCase();

  const age_min = clamp(url.searchParams.get("age_min"), 0, 120);
  const age_max = clamp(url.searchParams.get("age_max"), 0, 120);
  const h_min = clamp(url.searchParams.get("h_min"), 0, 300);
  const h_max = clamp(url.searchParams.get("h_max"), 0, 300);

  const score_min = clamp(url.searchParams.get("score_min"), 0, 1000000);
  const progress_min = clamp(url.searchParams.get("progress_min"), 0, 100);

  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||"50")));
  const cur = parseCursor(url.searchParams.get("cursor"));

  // Build WHERE pieces with safe binds
  const where = [];
  const bind = [];

  // talent role only
  where.push("r.name='talent'");

  if(loc){
    where.push("tp.location_norm LIKE ?");
    bind.push(`%${loc}%`);
  }
  if(gender){
    where.push("tp.gender = ?");
    bind.push(gender);
  }
  if(age_min != null){
    where.push("tp.age_years >= ?");
    bind.push(age_min);
  }
  if(age_max != null){
    where.push("tp.age_years <= ?");
    bind.push(age_max);
  }
  if(h_min != null){
    where.push("tp.height_cm >= ?");
    bind.push(h_min);
  }
  if(h_max != null){
    where.push("tp.height_cm <= ?");
    bind.push(h_max);
  }
  if(cat){
    where.push("lower(tp.category_csv) LIKE ?");
    bind.push(`%${cat}%`);
  }
  if(score_min != null){
    where.push("tp.score >= ?");
    bind.push(score_min);
  }
  if(progress_min != null){
    where.push("tp.progress_pct >= ?");
    bind.push(progress_min);
  }

  // cursor: order by score desc, then user_id desc
  if(cur){
    where.push("(tp.score < ? OR (tp.score = ? AND tp.user_id < ?))");
    bind.push(cur.score, cur.score, cur.id);
  }

  const sql = `
    SELECT
      tp.user_id, tp.name, tp.gender, tp.age_years, tp.location, tp.height_cm,
      tp.category_csv, tp.score, tp.progress_pct,
      tp.verified_email, tp.verified_phone, tp.verified_identity,
      u.email_norm, u.status, u.created_at
    FROM talent_profiles tp
    JOIN users u ON u.id=tp.user_id
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles r ON r.id=ur.role_id
    WHERE ${where.join(" AND ")}
    ORDER BY tp.score DESC, tp.user_id DESC
    LIMIT ?
  `;

  const rows = await env.DB.prepare(sql).bind(...bind, limit + 1).all();

  const list = rows.results || [];
  const hasMore = list.length > limit;
  const page = hasMore ? list.slice(0, limit) : list;
  const next_cursor = hasMore ? makeCursor(page[page.length-1]) : null;

  return json(200,"ok",{ rows: page, next_cursor });
}

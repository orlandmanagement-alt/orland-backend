import { json, requireAuth, hasRole } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

function normLoc(s){
  return String(s||"").trim().toLowerCase().replace(/\s+/g," ");
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);

  const q = String(url.searchParams.get("q")||"").trim().toLowerCase();
  const loc = normLoc(url.searchParams.get("location")||"");
  const gender = String(url.searchParams.get("gender")||"").trim();
  const minScore = Number(url.searchParams.get("min_score")||0);
  const minAge = Number(url.searchParams.get("min_age")||0);
  const maxAge = Number(url.searchParams.get("max_age")||99);
  const minH = Number(url.searchParams.get("min_height")||0);
  const maxH = Number(url.searchParams.get("max_height")||999);
  const category = String(url.searchParams.get("category")||"").trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||50)));

  // Talent = users that have role 'talent'
  // Optional: join talent_profiles if exists (won't crash if table missing)
  let hasTP = true;
  try{
    await env.DB.prepare("SELECT 1 FROM talent_profiles LIMIT 1").all();
  }catch{ hasTP = false; }

  const like = q ? `%${q}%` : null;

  let sql = `
    SELECT
      u.id, u.email_norm, u.display_name, u.status, u.created_at,
      ${hasTP ? `
      tp.gender, tp.age_years, tp.height_cm, tp.location, tp.score, tp.progress_pct, tp.category_csv
      ` : `
      NULL AS gender, NULL AS age_years, NULL AS height_cm, NULL AS location, 0 AS score, 0 AS progress_pct, '' AS category_csv
      `}
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles r ON r.id=ur.role_id AND r.name='talent'
    ${hasTP ? `LEFT JOIN talent_profiles tp ON tp.user_id=u.id` : ``}
    WHERE 1=1
  `;

  const bind = [];

  if(like){
    sql += ` AND (u.email_norm LIKE ? OR u.display_name LIKE ?) `;
    bind.push(like, like);
  }
  if(loc){
    sql += hasTP ? ` AND LOWER(tp.location) LIKE ? ` : ` AND 1=1 `;
    if(hasTP) bind.push(`%${loc}%`);
  }
  if(gender){
    sql += hasTP ? ` AND tp.gender=? ` : ` AND 1=1 `;
    if(hasTP) bind.push(gender);
  }
  if(hasTP){
    sql += ` AND tp.score >= ? AND (tp.age_years BETWEEN ? AND ?) AND (tp.height_cm BETWEEN ? AND ?) `;
    bind.push(minScore, minAge, maxAge, minH, maxH);
    if(category){
      sql += ` AND (','||LOWER(tp.category_csv)||',') LIKE ? `;
      bind.push(`%,${category},%`);
    }
  }

  sql += ` ORDER BY ${hasTP ? "tp.score DESC, tp.progress_pct DESC" : "u.created_at DESC"} LIMIT ? `;
  bind.push(limit);

  const rws = await env.DB.prepare(sql).bind(...bind).all();
  return json(200,"ok",{ users: rws.results || [] });
}

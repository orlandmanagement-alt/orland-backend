import { json, requireAuth, hasRole } from "../../../_lib.js";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

function normLoc(s){
  return String(s||"").trim().toLowerCase().replace(/\s+/g," ");
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);

  const q = (url.searchParams.get("q")||"").trim().toLowerCase();
  const location = normLoc(url.searchParams.get("location")||"");
  const gender = (url.searchParams.get("gender")||"").trim();
  const age_min = Number(url.searchParams.get("age_min")||"0") || 0;
  const age_max = Number(url.searchParams.get("age_max")||"0") || 0;
  const height_min = Number(url.searchParams.get("height_min")||"0") || 0;
  const height_max = Number(url.searchParams.get("height_max")||"0") || 0;
  const score_min = Number(url.searchParams.get("score_min")||"0") || 0;
  const progress_min = Number(url.searchParams.get("progress_min")||"0") || 0;

  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));
  const like = q ? `%${q}%` : null;

  // NOTE: menempel ke users + talent_profiles (jika belum ada row profile, tetap tampil)
  const r = await env.DB.prepare(`
    SELECT
      u.id,
      u.email_norm,
      u.display_name,
      u.status,
      u.created_at,
      u.updated_at,
      (SELECT MAX(created_at) FROM sessions s WHERE s.user_id=u.id) AS last_login_at,
      tp.gender,
      tp.age_years,
      tp.height_cm,
      tp.location AS tp_location,
      tp.location_norm,
      tp.category_csv,
      tp.score,
      tp.progress_pct,
      tp.verified_email,
      tp.verified_phone,
      tp.verified_identity
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles ro ON ro.id=ur.role_id AND ro.name='talent'
    LEFT JOIN talent_profiles tp ON tp.user_id=u.id
    WHERE
      ( ? IS NULL OR u.email_norm LIKE ? OR u.display_name LIKE ? )
      AND ( ? = '' OR tp.location_norm = ? )
      AND ( ? = '' OR tp.gender = ? )
      AND ( ? = 0 OR (tp.age_years IS NOT NULL AND tp.age_years >= ?) )
      AND ( ? = 0 OR (tp.age_years IS NOT NULL AND tp.age_years <= ?) )
      AND ( ? = 0 OR (tp.height_cm IS NOT NULL AND tp.height_cm >= ?) )
      AND ( ? = 0 OR (tp.height_cm IS NOT NULL AND tp.height_cm <= ?) )
      AND ( ? = 0 OR (tp.score IS NOT NULL AND tp.score >= ?) )
      AND ( ? = 0 OR (tp.progress_pct IS NOT NULL AND tp.progress_pct >= ?) )
    ORDER BY COALESCE(tp.score,0) DESC, COALESCE(tp.progress_pct,0) DESC, u.created_at DESC
    LIMIT ?
  `).bind(
    like, like, like,
    location, location,
    gender, gender,
    age_min, age_min,
    age_max, age_max,
    height_min, height_min,
    height_max, height_max,
    score_min, score_min,
    progress_min, progress_min,
    limit
  ).all();

  const users = (r.results||[]).map(x=>({
    id:x.id,
    email_norm:x.email_norm,
    display_name:x.display_name,
    status:x.status,
    created_at:x.created_at,
    updated_at:x.updated_at,
    last_login_at:x.last_login_at,
    profile: {
      gender:x.gender||"",
      age_years:x.age_years ?? null,
      height_cm:x.height_cm ?? null,
      location:x.tp_location||"",
      location_norm:x.location_norm||"",
      category_csv:x.category_csv||"",
      score:x.score ?? 0,
      progress_pct:x.progress_pct ?? 0,
      verified_email:Number(x.verified_email||0),
      verified_phone:Number(x.verified_phone||0),
      verified_identity:Number(x.verified_identity||0),
    }
  }));

  return json(200,"ok",{ users });
}

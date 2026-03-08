import { json, requireAuth, hasRole } from "../../_lib.js";

function clampInt(v, min, max){
  const n = Number(v);
  if(!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normStr(v){ return String(v||"").trim(); }

function ageExpr(){
  // dob format: YYYY-MM-DD
  // age ~ year(now) - year(dob) with month/day adjustment
  return `
    (CAST(strftime('%Y','now') AS INTEGER) - CAST(substr(tp.dob,1,4) AS INTEGER))
    - CASE
        WHEN (strftime('%m-%d','now') < substr(tp.dob,6,5)) THEN 1
        ELSE 0
      END
  `;
}

async function queryWithJsonEach(env, sql, binds){
  return await env.DB.prepare(sql).bind(...binds).all();
}

async function queryWithLikeFallback(env, baseSql, binds, category){
  // Replace JSON category filter with LIKE
  const sql = baseSql.replace(
    "/*CATEGORY_FILTER*/",
    "AND (tp.categories_json LIKE ?)"
  );
  const likeCat = `%${String(category).replace(/[%_]/g, "")}%`;
  return await env.DB.prepare(sql).bind(...binds, likeCat).all();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);

  const q = normStr(url.searchParams.get("q")).toLowerCase();
  const limit = clampInt(url.searchParams.get("limit"), 1, 200) ?? 50;

  const gender = normStr(url.searchParams.get("gender")).toLowerCase();
  const location = normStr(url.searchParams.get("location"));
  const category = normStr(url.searchParams.get("category"));

  const age_min = clampInt(url.searchParams.get("age_min"), 0, 120);
  const age_max = clampInt(url.searchParams.get("age_max"), 0, 120);
  const height_min = clampInt(url.searchParams.get("height_min"), 0, 300);
  const height_max = clampInt(url.searchParams.get("height_max"), 0, 300);
  const score_min = clampInt(url.searchParams.get("score_min"), 0, 9999999);

  const like = q ? `%${q}%` : null;
  const locLike = location ? `%${location}%` : null;

  const AGE = ageExpr();

  // Base SQL (category filter injected via placeholder so we can fallback)
  const baseSql = `
    SELECT
      u.id, u.email_norm, u.display_name, u.status,
      u.created_at, u.updated_at,
      MAX(s.created_at) AS last_login_at,
      GROUP_CONCAT(ro.name) AS roles,

      tp.gender, tp.dob, tp.location, tp.height_cm,
      tp.categories_json, tp.score_int, tp.profile_percent,
      tp.verified_email, tp.verified_phone, tp.verified_ktp, tp.verified_selfie

    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles rrole ON rrole.id=ur.role_id AND rrole.name='talent'
    LEFT JOIN user_roles ur2 ON ur2.user_id=u.id
    LEFT JOIN roles ro ON ro.id=ur2.role_id
    LEFT JOIN sessions s ON s.user_id=u.id
    LEFT JOIN talent_profiles tp ON tp.user_id=u.id

    WHERE 1=1
      AND ( ? IS NULL OR u.email_norm LIKE ? OR u.display_name LIKE ? )

      AND ( ? IS NULL OR LOWER(tp.gender) = ? )
      AND ( ? IS NULL OR tp.location LIKE ? )

      AND ( ? IS NULL OR tp.score_int >= ? )
      AND ( ? IS NULL OR tp.height_cm >= ? )
      AND ( ? IS NULL OR tp.height_cm <= ? )

      AND ( ? IS NULL OR tp.dob IS NOT NULL AND (${AGE}) >= ? )
      AND ( ? IS NULL OR tp.dob IS NOT NULL AND (${AGE}) <= ? )

      /*CATEGORY_FILTER*/

    GROUP BY u.id
    ORDER BY tp.score_int DESC, u.created_at DESC
    LIMIT ?
  `;

  // binds for everything except category (handled separately)
  const binds = [
    like, like, like,
    gender ? gender : null, gender ? gender : null,
    locLike, locLike,
    (score_min!=null ? score_min : null), (score_min!=null ? score_min : null),
    (height_min!=null ? height_min : null), (height_min!=null ? height_min : null),
    (height_max!=null ? height_max : null), (height_max!=null ? height_max : null),
    (age_min!=null ? age_min : null), (age_min!=null ? age_min : null),
    (age_max!=null ? age_max : null), (age_max!=null ? age_max : null),
  ];

  let result;

  if(category){
    // Try JSON1 approach: EXISTS json_each(tp.categories_json)
    const sql = baseSql.replace(
      "/*CATEGORY_FILTER*/",
      "AND EXISTS (SELECT 1 FROM json_each(tp.categories_json) WHERE LOWER(value)=LOWER(?))"
    );
    try{
      result = await queryWithJsonEach(env, sql, [...binds, category, limit]);
    }catch(e){
      // Fallback: LIKE (works even if JSON1 missing)
      result = await queryWithLikeFallback(env, baseSql, [...binds, limit], category);
      // queryWithLikeFallback binds include LIMIT already in binds, so fix:
      // We built fallback by adding LIKE at end; easiest: re-run proper fallback with correct bind order:
      // (but to avoid complexity, do a simpler fallback SQL now)
      const sql2 = baseSql.replace(
        "/*CATEGORY_FILTER*/",
        "AND (tp.categories_json LIKE ?)"
      );
      const likeCat = `%${category.replace(/[%_]/g,"")}%`;
      result = await env.DB.prepare(sql2).bind(...binds, likeCat, limit).all();
    }
  } else {
    const sql = baseSql.replace("/*CATEGORY_FILTER*/", "");
    result = await env.DB.prepare(sql).bind(...binds, limit).all();
  }

  const users = (result.results||[]).map(x=>({
    id:x.id,
    email_norm:x.email_norm,
    display_name:x.display_name,
    status:x.status,
    roles: String(x.roles||"").split(",").filter(Boolean),
    last_login_at: x.last_login_at || null,

    gender: x.gender || null,
    dob: x.dob || null,
    location: x.location || null,
    height_cm: (x.height_cm==null ? null : Number(x.height_cm)),
    categories: (()=>{ try{ return JSON.parse(x.categories_json||"[]"); }catch{ return []; } })(),
    score_int: Number(x.score_int||0),
    profile_percent: Number(x.profile_percent||0),
    verified_email: Number(x.verified_email||0),
    verified_phone: Number(x.verified_phone||0),
    verified_ktp: Number(x.verified_ktp||0),
    verified_selfie: Number(x.verified_selfie||0),
  }));

  return json(200,"ok",{
    users,
    filters: {
      q, gender, location, category,
      age_min, age_max, height_min, height_max, score_min,
      limit
    }
  });
}

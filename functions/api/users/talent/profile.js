import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function asText(v){ return String(v ?? "").trim(); }
function asInt(v){
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.trunc(n);
}
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

function calcProfilePct(p){
  // Simple completeness model (bisa kamu upgrade nanti)
  // gender, dob, height_cm, location, categories -> 5 items
  let ok = 0, total = 5;
  if (p.gender) ok++;
  if (p.dob) ok++;
  if (p.height_cm != null && p.height_cm > 0) ok++;
  if (p.location) ok++;
  if (Array.isArray(p.categories) && p.categories.length) ok++;
  return Math.round((ok/total) * 100);
}

function calcScore(pct, categories){
  // Score = base dari pct + bonus kategori + bonus PRO
  const catBonus = clamp((Array.isArray(categories) ? categories.length : 0) * 2, 0, 20);
  const proBonus = pct >= 90 ? 30 : (pct >= 75 ? 10 : 0);
  return clamp(Math.round(pct + catBonus + proBonus), 0, 200);
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};

  const isTalent = hasRole(a.roles, ["talent"]);
  const canAdminWrite = hasRole(a.roles, ["super_admin","admin","staff"]);

  // Talent boleh update dirinya sendiri. Admin/staff boleh update siapapun (untuk maintenance).
  let user_id = asText(body.user_id);
  if (isTalent) user_id = a.uid;
  if (!user_id) return json(400,"invalid_input",{ message:"missing_user_id" });
  if (!isTalent && !canAdminWrite) return json(403,"forbidden",null);

  const gender = asText(body.gender) || null;
  const dob = asText(body.dob) || null;                 // YYYY-MM-DD
  const height_cm = asInt(body.height_cm);              // integer
  const location = asText(body.location) || null;

  let categories = body.categories;
  if (!Array.isArray(categories)) {
    // allow comma-separated string
    const s = asText(categories);
    categories = s ? s.split(",").map(x=>x.trim()).filter(Boolean) : [];
  }
  // sanitize categories
  categories = categories.map(x=>asText(x)).filter(Boolean).slice(0, 30);

  const profile_pct = calcProfilePct({ gender, dob, height_cm, location, categories });
  const score = calcScore(profile_pct, categories);

  const now = nowSec();

  // Ensure user is actually talent (avoid writing random users)
  const chk = await env.DB.prepare(`
    SELECT 1 AS ok
    FROM user_roles ur
    JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=? AND r.name='talent'
    LIMIT 1
  `).bind(user_id).first();

  if(!chk) return json(404,"not_found",{ message:"user_not_talent" });

  // Upsert talent_profiles
  await env.DB.prepare(`
    INSERT INTO talent_profiles
      (user_id, gender, dob, height_cm, location, categories_json, score, profile_pct, updated_at, created_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      gender=excluded.gender,
      dob=excluded.dob,
      height_cm=excluded.height_cm,
      location=excluded.location,
      categories_json=excluded.categories_json,
      score=excluded.score,
      profile_pct=excluded.profile_pct,
      updated_at=excluded.updated_at
  `).bind(
    user_id,
    gender,
    dob,
    (height_cm==null ? null : height_cm),
    location,
    JSON.stringify(categories),
    score,
    profile_pct,
    now,
    now
  ).run();

  // Optional: reflect completion in users table if column exists
  try{
    await env.DB.prepare(`UPDATE users SET profile_completed=? , updated_at=? WHERE id=?`)
      .bind(profile_pct >= 90 ? 1 : 0, now, user_id).run();
  }catch{}

  return json(200,"ok",{ user_id, profile_pct, score, categories });
}

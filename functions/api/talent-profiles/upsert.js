import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function canWrite(a){
  // talent can update themselves later; for now admin/staff/super_admin allowed
  return hasRole(a.roles, ["super_admin","admin","staff","talent"]);
}

function parseDobToAgeYears(dob){
  // dob "YYYY-MM-DD"
  try{
    const m = String(dob||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return null;
    const y = Number(m[1]), mo = Number(m[2]) - 1, da = Number(m[3]);
    const birth = new Date(Date.UTC(y, mo, da));
    const now = new Date();
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    const mdiff = now.getUTCMonth() - birth.getUTCMonth();
    if(mdiff < 0 || (mdiff === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
    if(age < 0 || age > 120) return null;
    return age;
  }catch{ return null; }
}

function calcProfilePercent(p){
  // simple, stable scoring (100 max)
  // adjust later without breaking schema (weights only)
  const fields = [
    ["gender", 8],
    ["dob", 10],
    ["location_text", 10],
    ["height_cm", 10],
    ["categories", 12],
    ["skills", 10],
    ["social", 8],
    ["photos", 22],   // headshot/side/full/additional
    ["assets", 10]    // youtube/audio
  ];
  let score = 0;

  const has = (k)=>{
    const v = p[k];
    if(v == null) return false;
    if(Array.isArray(v)) return v.length > 0;
    if(typeof v === "object") return Object.keys(v||{}).some(x=>{
      const vv = v[x];
      return Array.isArray(vv) ? vv.length : String(vv||"").trim().length;
    });
    return String(v).trim().length > 0;
  };

  for(const [k,w] of fields){
    if(k === "photos"){
      const ph = p.photos || {};
      let c = 0;
      if(String(ph.headshot||"").trim()) c++;
      if(String(ph.side||"").trim()) c++;
      if(String(ph.full||"").trim()) c++;
      if(Array.isArray(ph.additional) && ph.additional.length) c++;
      // 0..4 mapped to weight
      score += Math.round((Math.min(4,c)/4)*w);
      continue;
    }
    if(k === "assets"){
      const as = p.assets || {};
      const c = (Array.isArray(as.youtube)?as.youtube.length:0) + (Array.isArray(as.audio)?as.audio.length:0);
      score += c > 0 ? w : 0;
      continue;
    }
    score += has(k) ? w : 0;
  }

  return Math.max(0, Math.min(100, score));
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const user_id = String(body.user_id || "").trim();
  if(!user_id) return json(400,"invalid_input",{ message:"user_id" });

  const gender = (body.gender ? String(body.gender).trim() : null);
  const dob = (body.dob ? String(body.dob).trim() : null);
  const height_cm = (body.height_cm==null || body.height_cm==="") ? null : Number(body.height_cm);
  const location_text = (body.location_text ? String(body.location_text).trim() : null);

  const categories = Array.isArray(body.categories) ? body.categories.map(x=>String(x).trim()).filter(Boolean) : [];
  const skills = Array.isArray(body.skills) ? body.skills.map(x=>String(x).trim()).filter(Boolean) : [];

  const social = (body.social && typeof body.social === "object") ? body.social : {};
  const photos = (body.photos && typeof body.photos === "object") ? body.photos : {};
  const assets = (body.assets && typeof body.assets === "object") ? body.assets : {};
  const meta = (body.meta && typeof body.meta === "object") ? body.meta : {};

  const age_years = dob ? parseDobToAgeYears(dob) : null;

  const grade_score = Number(body.grade_score || 0);
  const computed_percent = calcProfilePercent({ gender, dob, location_text, height_cm, categories, skills, social, photos, assets });
  const profile_percent = (body.profile_percent==null || body.profile_percent==="")
    ? computed_percent
    : Math.max(0, Math.min(100, Number(body.profile_percent)));

  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO talent_profiles (
      user_id, gender, dob, age_years, height_cm, location_text,
      categories_json, skills_json, social_json, photos_json, assets_json,
      grade_score, profile_percent, meta_json, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      gender=excluded.gender,
      dob=excluded.dob,
      age_years=excluded.age_years,
      height_cm=excluded.height_cm,
      location_text=excluded.location_text,
      categories_json=excluded.categories_json,
      skills_json=excluded.skills_json,
      social_json=excluded.social_json,
      photos_json=excluded.photos_json,
      assets_json=excluded.assets_json,
      grade_score=excluded.grade_score,
      profile_percent=excluded.profile_percent,
      meta_json=excluded.meta_json,
      updated_at=excluded.updated_at
  `).bind(
    user_id,
    gender,
    dob,
    age_years,
    (Number.isFinite(height_cm) ? height_cm : null),
    location_text,
    JSON.stringify(categories),
    JSON.stringify(skills),
    JSON.stringify(social),
    JSON.stringify(photos),
    JSON.stringify(assets),
    grade_score,
    profile_percent,
    JSON.stringify(meta),
    now,
    now
  ).run();

  return json(200,"ok",{ upserted:true, user_id, profile_percent, computed_percent });
}

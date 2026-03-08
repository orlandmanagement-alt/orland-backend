import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function safeJsonParse(s, fallback){
  try{ return JSON.parse(s); }catch{ return fallback; }
}
function normStr(v){ return String(v||"").trim(); }

function clampInt(v, min, max){
  const n = Number(v);
  if(!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["talent"])) return json(403,"forbidden",{ message:"talent_only" });

  const row = await env.DB.prepare(`
    SELECT user_id,gender,dob,location,height_cm,categories_json,score_int,profile_percent,
           verified_email,verified_phone,verified_ktp,verified_selfie,
           headshot_key,side_key,full_key,additional_keys_json,
           updated_at,created_at
    FROM talent_profiles
    WHERE user_id=?
    LIMIT 1
  `).bind(a.uid).first();

  if(!row){
    const now = nowSec();
    await env.DB.prepare(`INSERT INTO talent_profiles (user_id,updated_at,created_at) VALUES (?,?,?)`)
      .bind(a.uid, now, now).run();
    return json(200,"ok",{ profile:{
      user_id:a.uid, gender:null,dob:null,location:null,height_cm:null,
      categories:[], score_int:0, profile_percent:0,
      verified_email:0, verified_phone:0, verified_ktp:0, verified_selfie:0,
      photos:{ headshot_key:null, side_key:null, full_key:null, additional_keys:[] }
    }});
  }

  return json(200,"ok",{ profile:{
    user_id: row.user_id,
    gender: row.gender || null,
    dob: row.dob || null,
    location: row.location || null,
    height_cm: row.height_cm==null ? null : Number(row.height_cm),
    categories: safeJsonParse(row.categories_json||"[]", []),
    score_int: Number(row.score_int||0),
    profile_percent: Number(row.profile_percent||0),
    verified_email: Number(row.verified_email||0),
    verified_phone: Number(row.verified_phone||0),
    verified_ktp: Number(row.verified_ktp||0),
    verified_selfie: Number(row.verified_selfie||0),
    photos:{
      headshot_key: row.headshot_key || null,
      side_key: row.side_key || null,
      full_key: row.full_key || null,
      additional_keys: safeJsonParse(row.additional_keys_json||"[]", [])
    },
    updated_at: row.updated_at,
    created_at: row.created_at
  }});
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["talent"])) return json(403,"forbidden",{ message:"talent_only" });

  const body = await readJson(request) || {};
  const gender = normStr(body.gender).toLowerCase() || null;
  const dob = normStr(body.dob) || null;            // YYYY-MM-DD
  const location = normStr(body.location) || null;
  const height_cm = clampInt(body.height_cm, 0, 300);
  const categories = Array.isArray(body.categories) ? body.categories.map(x=>normStr(x)).filter(Boolean) : [];
  const now = nowSec();

  // Simple profile_percent heuristic (optional)
  let percent = 0;
  if(gender) percent += 15;
  if(dob) percent += 15;
  if(location) percent += 15;
  if(height_cm!=null) percent += 15;
  if(categories.length) percent += 20;

  await env.DB.prepare(`
    INSERT INTO talent_profiles (user_id,gender,dob,location,height_cm,categories_json,profile_percent,updated_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      gender=excluded.gender,
      dob=excluded.dob,
      location=excluded.location,
      height_cm=excluded.height_cm,
      categories_json=excluded.categories_json,
      profile_percent=excluded.profile_percent,
      updated_at=excluded.updated_at
  `).bind(
    a.uid,
    gender,
    dob,
    location,
    height_cm,
    JSON.stringify(categories),
    percent,
    now,
    now
  ).run();

  return json(200,"ok",{ saved:true, profile_percent: percent });
}

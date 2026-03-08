import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function normLoc(s){
  return String(s||"")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g,"")
    .replaceAll(/\s+/g," ")
    .slice(0,80);
}
function toInt(v){
  if(v==null) return null;
  const n = parseInt(String(v),10);
  return Number.isFinite(n) ? n : null;
}
function cleanCsv(arrOrStr){
  let arr = [];
  if(Array.isArray(arrOrStr)) arr = arrOrStr;
  else if(typeof arrOrStr === "string") arr = arrOrStr.split(",");
  return arr.map(x=>String(x||"").trim().toLowerCase()).filter(Boolean).slice(0,40).join(",");
}

function calcProgressAndScore(p){
  // Progress: % based on required fields completed
  // Score: progress_weight + verified boosts
  const fields = [
    !!p.name,
    !!p.gender,
    !!p.dob,
    !!p.location,
    (p.height_cm!=null && p.height_cm>0),
    !!p.category_csv
  ];
  const filled = fields.filter(Boolean).length;
  const progress = Math.round((filled / fields.length) * 100);

  const vEmail = Number(p.verified_email||0) ? 1 : 0;
  const vPhone = Number(p.verified_phone||0) ? 1 : 0;
  const vId    = Number(p.verified_identity||0) ? 1 : 0;

  // score baseline 0..10000
  let score = progress * 80; // 0..8000
  score += vEmail ? 600 : 0;
  score += vPhone ? 600 : 0;
  score += vId ? 1200 : 0;
  score = Math.max(0, Math.min(10000, score));

  return { progress_pct: progress, score };
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["talent"])) return json(403,"forbidden",{message:"talent_only"});

  const chk = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='talent_profiles' LIMIT 1").first();
  if(!chk) return json(500,"server_error",{message:"talent_profiles_missing",hint:"paste db/talent_profiles.sql to D1 console"});

  const tp = await env.DB.prepare(`
    SELECT user_id,name,gender,dob,age_years,location,location_norm,height_cm,category_csv,
           score,progress_pct,verified_email,verified_phone,verified_identity,created_at,updated_at
    FROM talent_profiles
    WHERE user_id=?
    LIMIT 1
  `).bind(a.uid).first();

  return json(200,"ok",{ profile: tp || null });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["talent"])) return json(403,"forbidden",{message:"talent_only"});

  const chk = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='talent_profiles' LIMIT 1").first();
  if(!chk) return json(500,"server_error",{message:"talent_profiles_missing",hint:"paste db/talent_profiles.sql to D1 console"});

  const body = await readJson(request) || {};
  const now = nowSec();

  // compute age_years from dob if provided
  const dob = (body.dob!=null) ? String(body.dob).trim().slice(0,10) : null;
  let age_years = null;
  if(dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)){
    try{
      const y = parseInt(dob.slice(0,4),10);
      const thisY = new Date().getUTCFullYear();
      age_years = Math.max(0, Math.min(120, thisY - y));
    }catch{}
  }

  const patch = {
    name: (body.name!=null) ? String(body.name).trim().slice(0,80) : null,
    gender: (body.gender!=null) ? String(body.gender).trim().slice(0,20) : null,
    dob,
    age_years,
    location: (body.location!=null) ? String(body.location).trim().slice(0,80) : null,
    height_cm: (body.height_cm!=null) ? Math.max(0, Math.min(300, toInt(body.height_cm)||0)) : null,
    category_csv: (body.category!=null) ? cleanCsv(body.category) : null,
  };
  patch.location_norm = patch.location ? normLoc(patch.location) : null;

  // ensure row exists
  await env.DB.prepare(`
    INSERT OR IGNORE INTO talent_profiles (
      user_id,name,gender,dob,age_years,location,location_norm,height_cm,category_csv,
      score,progress_pct,verified_email,verified_phone,verified_identity,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(a.uid, null,null,null,null,null,null,null,"", 0,0,0,0,0, now, now).run();

  // read current -> merge -> compute progress & score
  const cur = await env.DB.prepare(`
    SELECT name,gender,dob,age_years,location,location_norm,height_cm,category_csv,
           verified_email,verified_phone,verified_identity
    FROM talent_profiles WHERE user_id=? LIMIT 1
  `).bind(a.uid).first();

  const merged = {
    ...(cur||{}),
    ...(Object.fromEntries(Object.entries(patch).filter(([k,v])=>v!==null && v!==undefined)))
  };

  const { progress_pct, score } = calcProgressAndScore(merged);

  await env.DB.prepare(`
    UPDATE talent_profiles SET
      name = COALESCE(?, name),
      gender = COALESCE(?, gender),
      dob = COALESCE(?, dob),
      age_years = COALESCE(?, age_years),
      location = COALESCE(?, location),
      location_norm = COALESCE(?, location_norm),
      height_cm = COALESCE(?, height_cm),
      category_csv = COALESCE(?, category_csv),
      progress_pct = ?,
      score = ?,
      updated_at = ?
    WHERE user_id=?
  `).bind(
    patch.name, patch.gender, patch.dob, patch.age_years,
    patch.location, patch.location_norm,
    patch.height_cm, patch.category_csv,
    progress_pct, score,
    now,
    a.uid
  ).run();

  return json(200,"ok",{ updated:true, progress_pct, score });
}

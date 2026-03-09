import { json, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin"]); }

async function hasColumn(env, table, col){
  const r = await env.DB.prepare(`PRAGMA table_info('${table}')`).all();
  return (r.results||[]).some(x => String(x.name) === col);
}

function normLoc(s){
  return String(s||"").trim().toLowerCase().replace(/\s+/g," ");
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const now = nowSec();

  // ensure table exists
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_profiles (
      user_id TEXT PRIMARY KEY,
      name TEXT,
      gender TEXT,
      dob TEXT,
      age_years INTEGER,
      location TEXT,
      height_cm INTEGER,
      category_csv TEXT NOT NULL DEFAULT '',
      score INTEGER NOT NULL DEFAULT 0,
      progress_pct INTEGER NOT NULL DEFAULT 0,
      verified_email INTEGER NOT NULL DEFAULT 0,
      verified_phone INTEGER NOT NULL DEFAULT 0,
      verified_identity INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  const HAS_LOCNORM = await hasColumn(env, "talent_profiles", "location_norm");

  // insert missing profiles for talent users
  const ins = await env.DB.prepare(`
    INSERT OR IGNORE INTO talent_profiles
      (user_id,name,created_at,updated_at${HAS_LOCNORM ? ",location_norm" : ""})
    SELECT
      u.id,
      COALESCE(u.display_name,''),
      ?,
      ?
      ${HAS_LOCNORM ? ",NULL" : ""}
    FROM users u
    WHERE EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id=ur.role_id
      WHERE ur.user_id=u.id AND r.name='talent'
    )
  `).bind(now, now).run();

  // sync basic fields without overwriting custom data
  const upd = await env.DB.prepare(`
    UPDATE talent_profiles
    SET
      name = COALESCE((SELECT u.display_name FROM users u WHERE u.id=talent_profiles.user_id), talent_profiles.name),
      updated_at = ?
    WHERE user_id IN (
      SELECT u.id
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id=ur.role_id
        WHERE ur.user_id=u.id AND r.name='talent'
      )
    )
  `).bind(now).run();

  // optional normalize location_norm if column exists AND location filled
  let normed = 0;
  if(HAS_LOCNORM){
    const r = await env.DB.prepare(`
      UPDATE talent_profiles
      SET location_norm = LOWER(TRIM(REPLACE(location,'  ',' '))), updated_at=?
      WHERE (location_norm IS NULL OR location_norm='')
        AND location IS NOT NULL AND TRIM(location)!=''
    `).bind(now).run();
    normed = r?.meta?.changes ?? 0;
  }

  return json(200,"ok",{
    inserted: ins?.meta?.changes ?? 0,
    updated: upd?.meta?.changes ?? 0,
    normalized_location_norm: normed,
    location_norm_present: HAS_LOCNORM
  });
}

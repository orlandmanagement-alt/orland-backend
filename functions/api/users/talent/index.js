import { json, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

async function hasColumn(env, table, col){
  const r = await env.DB.prepare(`PRAGMA table_info('${table}')`).all();
  return (r.results||[]).some(x => String(x.name) === col);
}

function toInt(v, d=null){
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : d;
}

function normLoc(s){
  return String(s||"").trim().toLowerCase().replace(/\s+/g," ");
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  // Ensure table exists (match your schema, no extra columns assumed)
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

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q")||"").trim().toLowerCase();

  const loc = String(url.searchParams.get("location")||"").trim();
  const gender = String(url.searchParams.get("gender")||"").trim();

  const ageMin = toInt(url.searchParams.get("age_min"), null);
  const ageMax = toInt(url.searchParams.get("age_max"), null);

  const hMin = toInt(url.searchParams.get("height_min"), null);
  const hMax = toInt(url.searchParams.get("height_max"), null);

  const scoreMin = toInt(url.searchParams.get("score_min"), null);
  const scoreMax = toInt(url.searchParams.get("score_max"), null);

  const progMin = toInt(url.searchParams.get("progress_min"), null);

  const category = String(url.searchParams.get("category")||"").trim().toLowerCase();

  const limit = Math.min(200, Math.max(1, toInt(url.searchParams.get("limit"), 50)));
  const offset = Math.max(0, toInt(url.searchParams.get("offset"), 0));

  // base where clauses
  const where = [];
  const bind = [];

  // only talent users (join role)
  where.push(`EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=u.id AND r.name='talent'
  )`);

  if(q){
    where.push(`(u.email_norm LIKE ? OR u.display_name LIKE ? OR COALESCE(tp.name,'') LIKE ?)`);
    bind.push(`%${q}%`,`%${q}%`,`%${q}%`);
  }

  if(gender){
    where.push(`COALESCE(tp.gender,'') = ?`);
    bind.push(gender);
  }

  if(ageMin != null){ where.push(`COALESCE(tp.age_years, -1) >= ?`); bind.push(ageMin); }
  if(ageMax != null){ where.push(`COALESCE(tp.age_years, 999) <= ?`); bind.push(ageMax); }

  if(hMin != null){ where.push(`COALESCE(tp.height_cm, -1) >= ?`); bind.push(hMin); }
  if(hMax != null){ where.push(`COALESCE(tp.height_cm, 9999) <= ?`); bind.push(hMax); }

  if(scoreMin != null){ where.push(`COALESCE(tp.score,0) >= ?`); bind.push(scoreMin); }
  if(scoreMax != null){ where.push(`COALESCE(tp.score,0) <= ?`); bind.push(scoreMax); }

  if(progMin != null){ where.push(`COALESCE(tp.progress_pct,0) >= ?`); bind.push(progMin); }

  if(loc){
    if(HAS_LOCNORM){
      where.push(`COALESCE(tp.location_norm,'') LIKE ?`);
      bind.push(`%${normLoc(loc)}%`);
    }else{
      where.push(`COALESCE(tp.location,'') LIKE ?`);
      bind.push(`%${loc}%`);
    }
  }

  if(category){
    // category_csv stores comma separated values; do simple LIKE match
    where.push(`LOWER(COALESCE(tp.category_csv,'')) LIKE ?`);
    bind.push(`%${category}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      u.id,
      u.email_norm,
      u.display_name,
      u.status,
      u.created_at,
      u.updated_at,
      tp.name,
      tp.gender,
      tp.dob,
      tp.age_years,
      tp.location,
      ${HAS_LOCNORM ? "tp.location_norm," : "NULL AS location_norm,"}
      tp.height_cm,
      tp.category_csv,
      tp.score,
      tp.progress_pct,
      tp.verified_email,
      tp.verified_phone,
      tp.verified_identity
    FROM users u
    LEFT JOIN talent_profiles tp ON tp.user_id=u.id
    ${whereSql}
    ORDER BY tp.score DESC, tp.progress_pct DESC, u.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await env.DB.prepare(sql).bind(...bind, limit, offset).all();

  // count for pagination
  const csql = `
    SELECT COUNT(*) AS n
    FROM users u
    LEFT JOIN talent_profiles tp ON tp.user_id=u.id
    ${whereSql}
  `;
  const c = await env.DB.prepare(csql).bind(...bind).first();

  return json(200,"ok",{
    total: Number(c?.n||0),
    limit, offset,
    rows: (rows.results||[])
  });
}

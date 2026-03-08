import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get("limit")||"500")));

  // ensure table exists
  const chk = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='talent_profiles' LIMIT 1").first();
  if(!chk) return json(500,"server_error",{message:"talent_profiles_missing",hint:"apply db/talent_profiles.sql to D1 first"});

  const now = nowSec();

  // Find talent users missing profile
  const r = await env.DB.prepare(`
    SELECT u.id AS user_id, u.display_name AS name
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles ro ON ro.id=ur.role_id
    LEFT JOIN talent_profiles tp ON tp.user_id=u.id
    WHERE ro.name='talent' AND tp.user_id IS NULL
    ORDER BY u.created_at DESC
    LIMIT ?
  `).bind(limit).all();

  const rows = r.results || [];
  if(!rows.length) return json(200,"ok",{created:0});

  // Insert minimal profiles
  // NOTE: keep values empty by default; portal talent will fill later.
  const stmts = rows.map(x =>
    env.DB.prepare(`
      INSERT OR IGNORE INTO talent_profiles (
        user_id,name,gender,dob,location,location_norm,height_cm,category_csv,
        score,progress_pct,verified_email,verified_phone,verified_identity,
        created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      x.user_id,
      x.name || null,
      null,
      null,
      null,
      null,
      null,
      "",
      0,
      0,
      0,
      0,
      0,
      now,
      now
    )
  );

  // Run sequentially (safe for D1)
  let ok=0;
  for(const s of stmts){
    try{ await s.run(); ok++; }catch{}
  }

  return json(200,"ok",{created: ok});
}

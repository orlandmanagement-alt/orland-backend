import { json, requireAuth, hasRole } from "../../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  // Talent boleh lihat dirinya sendiri; admin/staff/super_admin boleh lihat semua
  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if(!id) return json(400,"invalid_input",{ message:"missing_id" });

  const isTalent = hasRole(a.roles, ["talent"]);
  const canAdminRead = hasRole(a.roles, ["super_admin","admin","staff"]);
  if(isTalent && id !== a.uid) return json(403,"forbidden",null);
  if(!isTalent && !canAdminRead) return json(403,"forbidden",null);

  const row = await env.DB.prepare(`
    SELECT
      u.id, u.email_norm, u.display_name, u.status,
      u.created_at, u.updated_at, u.last_login_at,
      tp.gender, tp.dob, tp.height_cm, tp.location,
      tp.profile_pct, tp.score, tp.categories_json,
      tp.created_at AS tp_created_at, tp.updated_at AS tp_updated_at
    FROM users u
    LEFT JOIN talent_profiles tp ON tp.user_id=u.id
    WHERE u.id=?
    LIMIT 1
  `).bind(id).first();

  if(!row) return json(404,"not_found",null);

  let categories = [];
  try{ categories = JSON.parse(row.categories_json||"[]") || []; }catch{}

  return json(200,"ok",{
    user:{
      id: row.id,
      email_norm: row.email_norm,
      display_name: row.display_name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_login_at: row.last_login_at
    },
    profile:{
      gender: row.gender || null,
      dob: row.dob || null,
      height_cm: row.height_cm ?? null,
      location: row.location || null,
      profile_pct: row.profile_pct ?? 0,
      score: row.score ?? 0,
      categories,
      created_at: row.tp_created_at || null,
      updated_at: row.tp_updated_at || null
    }
  });
}

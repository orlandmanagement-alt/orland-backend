import { json, requireAuth, hasRole } from "../../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

function csvToArr(s){
  return String(s||"").split(",").map(x=>x.trim()).filter(Boolean);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id")||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id"});

  const u = await env.DB.prepare(`
    SELECT u.id,u.email_norm,u.display_name,u.status,u.created_at,u.updated_at
    FROM users u
    WHERE u.id=? LIMIT 1
  `).bind(id).first();

  if(!u) return json(404,"not_found",null);

  const tp = await env.DB.prepare(`
    SELECT user_id,name,gender,dob,age_years,location,height_cm,category_csv,score,progress_pct,
           verified_email,verified_phone,verified_identity,created_at,updated_at
    FROM talent_profiles
    WHERE user_id=? LIMIT 1
  `).bind(id).first();

  return json(200,"ok",{
    user: u,
    profile: tp ? {
      ...tp,
      category: csvToArr(tp.category_csv)
    } : null
  });
}

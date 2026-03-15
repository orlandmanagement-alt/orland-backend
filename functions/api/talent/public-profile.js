import { json, requireAuth } from "../../_lib.js";
import { applyTalentContactPrivacy } from "../../_contact_privacy.js";

export async function onRequestGet({ request, env }){
  let roles = [];
  try{
    const a = await requireAuth(env, request);
    if(a?.ok) roles = Array.isArray(a.roles) ? a.roles : [];
  }catch{}

  const url = new URL(request.url);
  const slug = String(url.searchParams.get("slug") || "").trim();
  const user_id = String(url.searchParams.get("user_id") || "").trim();

  if(!slug && !user_id){
    return json(400, "invalid_input", { message: "slug_or_user_id_required" });
  }

  const whereSql = slug ? "tp.public_slug=?" : "u.id=?";
  const bindVal = slug || user_id;

  const row = await env.DB.prepare(`
    SELECT
      u.id,
      u.display_name,
      u.email_norm,
      u.phone_e164,
      tp.public_slug,
      tp.visibility_status,
      tp.visibility_reason,
      tpb.gender,
      tpb.dob,
      tpb.location,
      tcp.phone,
      tcp.email,
      tcp.website,
      tcp.contact_visibility,
      ta.height_cm,
      ta.weight_kg,
      ta.eye_color,
      ta.hair_color,
      COALESCE(tprog.completion_percent, 0) AS completion_percent
    FROM users u
    LEFT JOIN talent_profiles tp ON tp.user_id = u.id
    LEFT JOIN talent_profile_basic tpb ON tpb.user_id = u.id
    LEFT JOIN talent_contact_public tcp ON tcp.user_id = u.id
    LEFT JOIN talent_appearance ta ON ta.user_id = u.id
    LEFT JOIN talent_progress tprog ON tprog.user_id = u.id
    WHERE ${whereSql}
    LIMIT 1
  `).bind(bindVal).first();

  if(!row) return json(404, "not_found", { message: "talent_not_found" });

  const socials = await env.DB.prepare(`
    SELECT platform, url
    FROM talent_social_links
    WHERE user_id=?
    ORDER BY created_at ASC
  `).bind(row.id).all();

  const skills = await env.DB.prepare(`
    SELECT skill_name
    FROM talent_skills
    WHERE user_id=?
    ORDER BY created_at ASC
  `).bind(row.id).all();

  const interests = await env.DB.prepare(`
    SELECT interest_name
    FROM talent_interests
    WHERE user_id=?
    ORDER BY created_at ASC
  `).bind(row.id).all();

  const credits = await env.DB.prepare(`
    SELECT id, title, company, credit_month, credit_year, about, created_at, updated_at
    FROM talent_credits
    WHERE talent_id=?
    ORDER BY updated_at DESC, created_at DESC
  `).bind(row.id).all();

  const photos = await env.DB.prepare(`
    SELECT id, storage_key, sort_order, meta_json, created_at
    FROM talent_media
    WHERE talent_id=? AND media_type='photo' AND status='active'
    ORDER BY
      CASE
        WHEN json_extract(meta_json, '$.is_primary') = 1 THEN 0
        ELSE 1
      END,
      sort_order ASC,
      created_at DESC
  `).bind(row.id).all();

  const profile = applyTalentContactPrivacy({
    ...row,
    email_norm: row.email || row.email_norm || null,
    phone: row.phone || row.phone_e164 || null
  }, roles);

  return json(200, "ok", {
    profile,
    socials: socials.results || [],
    skills: (skills.results || []).map(x => x.skill_name),
    interests: (interests.results || []).map(x => x.interest_name),
    credits: credits.results || [],
    photos: photos.results || []
  });
}

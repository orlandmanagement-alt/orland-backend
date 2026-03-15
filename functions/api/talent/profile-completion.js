import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function ensureTables(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      display_name TEXT,
      public_slug TEXT,
      visibility_status TEXT DEFAULT 'private',
      visibility_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_profile_basic (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      gender TEXT,
      dob TEXT,
      location TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_contact_public (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      website TEXT,
      contact_visibility TEXT DEFAULT 'private',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_appearance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      height_cm INTEGER,
      weight_kg INTEGER,
      eye_color TEXT,
      hair_color TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_social_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_interests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      interest_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_progress (
      user_id TEXT PRIMARY KEY,
      completion_percent INTEGER NOT NULL DEFAULT 0,
      visibility_status TEXT DEFAULT 'private',
      visibility_reason TEXT,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_media (
      id TEXT PRIMARY KEY,
      talent_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      duration_sec INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      meta_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    )
  `).run();
}

async function recalcProgress(env, userId){
  const prof = await env.DB.prepare(`SELECT display_name, public_slug FROM talent_profiles WHERE user_id=? LIMIT 1`).bind(userId).first();
  const basic = await env.DB.prepare(`SELECT gender, dob, location FROM talent_profile_basic WHERE user_id=? LIMIT 1`).bind(userId).first();
  const contact = await env.DB.prepare(`SELECT email, phone, website FROM talent_contact_public WHERE user_id=? LIMIT 1`).bind(userId).first();
  const app = await env.DB.prepare(`SELECT height_cm, weight_kg, eye_color, hair_color FROM talent_appearance WHERE user_id=? LIMIT 1`).bind(userId).first();
  const skills = await env.DB.prepare(`SELECT COUNT(*) AS total FROM talent_skills WHERE user_id=?`).bind(userId).first();
  const interests = await env.DB.prepare(`SELECT COUNT(*) AS total FROM talent_interests WHERE user_id=?`).bind(userId).first();
  const socials = await env.DB.prepare(`SELECT COUNT(*) AS total FROM talent_social_links WHERE user_id=?`).bind(userId).first();
  const media = await env.DB.prepare(`SELECT COUNT(*) AS total FROM talent_media WHERE talent_id=? AND media_type='photo' AND status='active'`).bind(userId).first();

  let score = 0;
  if(prof?.display_name) score += 15;
  if(prof?.public_slug) score += 10;
  if(basic?.gender) score += 8;
  if(basic?.dob) score += 8;
  if(basic?.location) score += 8;
  if(contact?.phone) score += 8;
  if(contact?.website) score += 4;
  if(app?.height_cm) score += 6;
  if(app?.weight_kg) score += 4;
  if(app?.eye_color) score += 2;
  if(app?.hair_color) score += 2;
  if(Number(skills?.total || 0) > 0) score += 10;
  if(Number(interests?.total || 0) > 0) score += 5;
  if(Number(socials?.total || 0) > 0) score += 5;
  if(Number(media?.total || 0) > 0) score += 5;

  if(score > 100) score = 100;

  await env.DB.prepare(`
    INSERT INTO talent_progress (user_id, completion_percent, visibility_status, visibility_reason, phone_verified, updated_at)
    VALUES (?, ?, 'private', NULL, 0, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      completion_percent=excluded.completion_percent,
      updated_at=excluded.updated_at
  `).bind(userId, score, nowSec()).run();

  return score;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["talent","super_admin","admin","staff"])) return json(403, "forbidden", null);

  await ensureTables(env);

  const [profile, basic, contact, appearance, progress, skills, interests, socials, media] = await Promise.all([
    env.DB.prepare(`SELECT * FROM talent_profiles WHERE user_id=? LIMIT 1`).bind(a.uid).first(),
    env.DB.prepare(`SELECT * FROM talent_profile_basic WHERE user_id=? LIMIT 1`).bind(a.uid).first(),
    env.DB.prepare(`SELECT * FROM talent_contact_public WHERE user_id=? LIMIT 1`).bind(a.uid).first(),
    env.DB.prepare(`SELECT * FROM talent_appearance WHERE user_id=? LIMIT 1`).bind(a.uid).first(),
    env.DB.prepare(`SELECT * FROM talent_progress WHERE user_id=? LIMIT 1`).bind(a.uid).first(),
    env.DB.prepare(`SELECT skill_name FROM talent_skills WHERE user_id=? ORDER BY created_at ASC`).bind(a.uid).all(),
    env.DB.prepare(`SELECT interest_name FROM talent_interests WHERE user_id=? ORDER BY created_at ASC`).bind(a.uid).all(),
    env.DB.prepare(`SELECT platform, url FROM talent_social_links WHERE user_id=? ORDER BY created_at ASC`).bind(a.uid).all(),
    env.DB.prepare(`SELECT id, storage_key, meta_json, created_at FROM talent_media WHERE talent_id=? AND media_type='photo' AND status='active' ORDER BY sort_order ASC, created_at DESC`).bind(a.uid).all()
  ]);

  return json(200, "ok", {
    profile: profile || {},
    basic: basic || {},
    contact: contact || {},
    appearance: appearance || {},
    progress: progress || { completion_percent: 0 },
    skills: (skills.results || []).map(x => x.skill_name),
    interests: (interests.results || []).map(x => x.interest_name),
    socials: socials.results || [],
    media: media.results || []
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["talent","super_admin","admin","staff"])) return json(403, "forbidden", null);

  await ensureTables(env);

  const body = await readJson(request) || {};
  const now = nowSec();

  const profile = body.profile || {};
  const basic = body.basic || {};
  const contact = body.contact || {};
  const appearance = body.appearance || {};
  const skills = Array.isArray(body.skills) ? body.skills.map(x => String(x).trim()).filter(Boolean) : [];
  const interests = Array.isArray(body.interests) ? body.interests.map(x => String(x).trim()).filter(Boolean) : [];
  const socials = Array.isArray(body.socials) ? body.socials : [];

  const profRow = await env.DB.prepare(`SELECT id FROM talent_profiles WHERE user_id=? LIMIT 1`).bind(a.uid).first();
  if(profRow){
    await env.DB.prepare(`
      UPDATE talent_profiles
      SET display_name=?, public_slug=?, visibility_status=?, visibility_reason=?, updated_at=?
      WHERE user_id=?
    `).bind(
      String(profile.display_name || "") || null,
      String(profile.public_slug || "") || null,
      String(profile.visibility_status || "private") || "private",
      String(profile.visibility_reason || "") || null,
      now,
      a.uid
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO talent_profiles (id, user_id, display_name, public_slug, visibility_status, visibility_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      a.uid,
      String(profile.display_name || "") || null,
      String(profile.public_slug || "") || null,
      String(profile.visibility_status || "private") || "private",
      String(profile.visibility_reason || "") || null,
      now,
      now
    ).run();
  }

  const basicRow = await env.DB.prepare(`SELECT id FROM talent_profile_basic WHERE user_id=? LIMIT 1`).bind(a.uid).first();
  if(basicRow){
    await env.DB.prepare(`
      UPDATE talent_profile_basic
      SET gender=?, dob=?, location=?, updated_at=?
      WHERE user_id=?
    `).bind(
      String(basic.gender || "") || null,
      String(basic.dob || "") || null,
      String(basic.location || "") || null,
      now,
      a.uid
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO talent_profile_basic (id, user_id, gender, dob, location, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      a.uid,
      String(basic.gender || "") || null,
      String(basic.dob || "") || null,
      String(basic.location || "") || null,
      now,
      now
    ).run();
  }

  const contactRow = await env.DB.prepare(`SELECT id FROM talent_contact_public WHERE user_id=? LIMIT 1`).bind(a.uid).first();
  if(contactRow){
    await env.DB.prepare(`
      UPDATE talent_contact_public
      SET email=?, phone=?, website=?, contact_visibility=?, updated_at=?
      WHERE user_id=?
    `).bind(
      String(contact.email || "") || null,
      String(contact.phone || "") || null,
      String(contact.website || "") || null,
      String(contact.contact_visibility || "private") || "private",
      now,
      a.uid
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO talent_contact_public (id, user_id, email, phone, website, contact_visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      a.uid,
      String(contact.email || "") || null,
      String(contact.phone || "") || null,
      String(contact.website || "") || null,
      String(contact.contact_visibility || "private") || "private",
      now,
      now
    ).run();
  }

  const appRow = await env.DB.prepare(`SELECT id FROM talent_appearance WHERE user_id=? LIMIT 1`).bind(a.uid).first();
  if(appRow){
    await env.DB.prepare(`
      UPDATE talent_appearance
      SET height_cm=?, weight_kg=?, eye_color=?, hair_color=?, updated_at=?
      WHERE user_id=?
    `).bind(
      appearance.height_cm ? Number(appearance.height_cm) : null,
      appearance.weight_kg ? Number(appearance.weight_kg) : null,
      String(appearance.eye_color || "") || null,
      String(appearance.hair_color || "") || null,
      now,
      a.uid
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO talent_appearance (id, user_id, height_cm, weight_kg, eye_color, hair_color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      a.uid,
      appearance.height_cm ? Number(appearance.height_cm) : null,
      appearance.weight_kg ? Number(appearance.weight_kg) : null,
      String(appearance.eye_color || "") || null,
      String(appearance.hair_color || "") || null,
      now,
      now
    ).run();
  }

  await env.DB.prepare(`DELETE FROM talent_skills WHERE user_id=?`).bind(a.uid).run();
  for(const skill of skills){
    await env.DB.prepare(`
      INSERT INTO talent_skills (id, user_id, skill_name, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), a.uid, skill, now).run();
  }

  await env.DB.prepare(`DELETE FROM talent_interests WHERE user_id=?`).bind(a.uid).run();
  for(const item of interests){
    await env.DB.prepare(`
      INSERT INTO talent_interests (id, user_id, interest_name, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), a.uid, item, now).run();
  }

  await env.DB.prepare(`DELETE FROM talent_social_links WHERE user_id=?`).bind(a.uid).run();
  for(const s of socials){
    const platform = String(s.platform || "").trim();
    const url = String(s.url || "").trim();
    if(!platform || !url) continue;
    await env.DB.prepare(`
      INSERT INTO talent_social_links (id, user_id, platform, url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), a.uid, platform, url, now, now).run();
  }

  const completion_percent = await recalcProgress(env, a.uid);

  await env.DB.prepare(`
    UPDATE users
    SET profile_completed = CASE WHEN ? >= 80 THEN 1 ELSE 0 END,
        updated_at=?
    WHERE id=?
  `).bind(completion_percent, now, a.uid).run();

  return json(200, "ok", {
    saved: true,
    completion_percent
  });
}

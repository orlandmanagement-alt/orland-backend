import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

function extFromType(type){
  const t = String(type || "").toLowerCase();
  if(t.includes("jpeg") || t.includes("jpg")) return "jpg";
  if(t.includes("png")) return "png";
  if(t.includes("webp")) return "webp";
  return "bin";
}

function isAllowed(type){
  const t = String(type || "").toLowerCase();
  return t === "image/jpeg" || t === "image/jpg" || t === "image/png" || t === "image/webp";
}

async function ensureTables(env){
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
}

async function recalcProgress(env, userId){
  const prof = await env.DB.prepare(`SELECT 1 AS ok FROM talent_profiles WHERE user_id=? LIMIT 1`).bind(userId).first();
  const basic = await env.DB.prepare(`SELECT 1 AS ok FROM talent_profile_basic WHERE user_id=? LIMIT 1`).bind(userId).first();
  const contact = await env.DB.prepare(`SELECT 1 AS ok FROM talent_contact_public WHERE user_id=? LIMIT 1`).bind(userId).first();
  const app = await env.DB.prepare(`SELECT 1 AS ok FROM talent_appearance WHERE user_id=? LIMIT 1`).bind(userId).first();
  const skills = await env.DB.prepare(`SELECT COUNT(*) AS total FROM talent_skills WHERE user_id=?`).bind(userId).first();
  const interests = await env.DB.prepare(`SELECT COUNT(*) AS total FROM talent_interests WHERE user_id=?`).bind(userId).first();
  const socials = await env.DB.prepare(`SELECT COUNT(*) AS total FROM talent_social_links WHERE user_id=?`).bind(userId).first();
  const media = await env.DB.prepare(`SELECT COUNT(*) AS total FROM talent_media WHERE talent_id=? AND media_type='photo' AND status='active'`).bind(userId).first();

  let score = 0;
  if(prof) score += 15;
  if(basic) score += 25;
  if(contact) score += 20;
  if(app) score += 10;
  if(Number(skills?.total || 0) > 0) score += 10;
  if(Number(interests?.total || 0) > 0) score += 5;
  if(Number(socials?.total || 0) > 0) score += 5;
  if(Number(media?.total || 0) > 0) score += 10;
  if(score > 100) score = 100;

  await env.DB.prepare(`
    INSERT INTO talent_progress (user_id, completion_percent, visibility_status, visibility_reason, phone_verified, updated_at)
    VALUES (?, ?, 'private', NULL, 0, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      completion_percent=excluded.completion_percent,
      updated_at=excluded.updated_at
  `).bind(userId, score, nowSec()).run();

  await env.DB.prepare(`
    UPDATE users
    SET profile_completed = CASE WHEN ? >= 80 THEN 1 ELSE 0 END,
        updated_at=?
    WHERE id=?
  `).bind(score, nowSec(), userId).run();

  return score;
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin","staff","talent"])){
    return json(403, "forbidden", null);
  }

  if(!env.TALENT_MEDIA_BUCKET){
    return json(500, "server_error", { message: "missing_r2_binding_TALENT_MEDIA_BUCKET" });
  }

  await ensureTables(env);

  const form = await request.formData();
  const files = form.getAll("files");

  if(!files || !files.length){
    return json(400, "invalid_input", { message: "files_required" });
  }

  const existing = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM talent_media
    WHERE talent_id=? AND media_type='photo' AND status='active'
  `).bind(a.uid).first();

  let sortBase = Number(existing?.total || 0);
  const uploaded = [];
  const errors = [];

  for(const file of files){
    try{
      if(!file || typeof file.arrayBuffer !== "function"){
        errors.push({ name: "", message: "invalid_file" });
        continue;
      }

      const mime = String(file.type || "").toLowerCase();
      if(!isAllowed(mime)){
        errors.push({ name: String(file.name || ""), message: "invalid_file_type" });
        continue;
      }

      const size = Number(file.size || 0);
      if(size <= 0){
        errors.push({ name: String(file.name || ""), message: "empty_file" });
        continue;
      }

      if(size > 5 * 1024 * 1024){
        errors.push({ name: String(file.name || ""), message: "file_too_large_max_5mb" });
        continue;
      }

      const ext = extFromType(mime);
      const mediaId = crypto.randomUUID();
      const key = `talent/${a.uid}/photo/${mediaId}.${ext}`;
      const buf = await file.arrayBuffer();

      await env.TALENT_MEDIA_BUCKET.put(key, buf, {
        httpMetadata: { contentType: mime }
      });

      const rowCount = await env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM talent_media
        WHERE talent_id=? AND media_type='photo' AND status='active'
      `).bind(a.uid).first();

      const isPrimary = Number(rowCount?.total || 0) === 0 ? 1 : 0;
      const meta = {
        original_name: String(file.name || ""),
        source: "multi_photo_upload",
        is_primary: isPrimary
      };

      await env.DB.prepare(`
        INSERT INTO talent_media (
          id, talent_id, media_type, storage_key, mime_type, file_size,
          width, height, duration_sec, sort_order, status, meta_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 'active', ?, ?)
      `).bind(
        mediaId,
        a.uid,
        "photo",
        key,
        mime,
        size,
        sortBase,
        JSON.stringify(meta),
        nowSec()
      ).run();

      sortBase += 1;
      uploaded.push({
        media_id: mediaId,
        storage_key: key,
        mime_type: mime,
        file_size: size,
        is_primary: isPrimary === 1
      });
    }catch(err){
      errors.push({ name: String(file?.name || ""), message: String(err?.message || err) });
    }
  }

  const completion_percent = await recalcProgress(env, a.uid);

  return json(200, "ok", {
    uploaded_count: uploaded.length,
    uploaded,
    errors,
    completion_percent
  });
}

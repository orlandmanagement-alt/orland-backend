import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

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
  const media = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM talent_media
    WHERE talent_id=? AND media_type='photo' AND status='active'
  `).bind(userId).first();

  const current = await env.DB.prepare(`
    SELECT completion_percent
    FROM talent_progress
    WHERE user_id=?
    LIMIT 1
  `).bind(userId).first();

  let score = Number(current?.completion_percent || 0);
  if(Number(media?.total || 0) <= 0 && score >= 20) score -= 20;
  if(score < 0) score = 0;

  await env.DB.prepare(`
    INSERT INTO talent_progress (user_id, completion_percent, visibility_status, visibility_reason, phone_verified, updated_at)
    VALUES (?, ?, 'private', NULL, 0, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      completion_percent=excluded.completion_percent,
      updated_at=excluded.updated_at
  `).bind(userId, score, nowSec()).run();

  return score;
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin","staff","talent"])){
    return json(403, "forbidden", null);
  }

  await ensureTables(env);

  const body = await readJson(request) || {};
  const media_id = String(body.media_id || "").trim();

  if(!media_id) return json(400, "invalid_input", { message: "media_id" });

  const row = await env.DB.prepare(`
    SELECT id, storage_key, meta_json
    FROM talent_media
    WHERE id=? AND talent_id=? AND status='active'
    LIMIT 1
  `).bind(media_id, a.uid).first();

  if(!row) return json(404, "not_found", { message: "media_not_found" });

  await env.DB.prepare(`
    UPDATE talent_media
    SET status='deleted'
    WHERE id=?
  `).bind(media_id).run();

  if(env.TALENT_MEDIA_BUCKET && row.storage_key){
    try{ await env.TALENT_MEDIA_BUCKET.delete(String(row.storage_key)); }catch{}
  }

  const active = await env.DB.prepare(`
    SELECT id, meta_json
    FROM talent_media
    WHERE talent_id=? AND media_type='photo' AND status='active'
    ORDER BY sort_order ASC, created_at DESC
  `).bind(a.uid).all();

  const items = active.results || [];
  const hasPrimary = items.some(x => {
    try{
      const meta = JSON.parse(x.meta_json || "{}");
      return Number(meta.is_primary || 0) === 1;
    }catch{
      return false;
    }
  });

  if(!hasPrimary && items.length){
    let meta = {};
    try{ meta = JSON.parse(items[0].meta_json || "{}"); }catch{}
    meta.is_primary = 1;
    await env.DB.prepare(`
      UPDATE talent_media
      SET meta_json=?
      WHERE id=?
    `).bind(JSON.stringify(meta), items[0].id).run();
  }

  const completion_percent = await recalcProgress(env, a.uid);

  return json(200, "ok", {
    removed: true,
    media_id,
    completion_percent
  });
}

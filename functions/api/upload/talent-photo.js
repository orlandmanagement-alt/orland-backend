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

async function ensureTalentMediaTable(env){
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

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin","staff","talent"])){
    return json(403, "forbidden", null);
  }

  if(!env.TALENT_MEDIA_BUCKET){
    return json(500, "server_error", { message: "missing_r2_binding_TALENT_MEDIA_BUCKET" });
  }

  await ensureTalentMediaTable(env);

  const form = await request.formData();
  const file = form.get("file");

  if(!file || typeof file.arrayBuffer !== "function"){
    return json(400, "invalid_input", { message: "file_required" });
  }

  const mime = String(file.type || "").toLowerCase();
  if(!isAllowed(mime)){
    return json(400, "invalid_input", { message: "invalid_file_type" });
  }

  const size = Number(file.size || 0);
  if(size <= 0){
    return json(400, "invalid_input", { message: "empty_file" });
  }

  if(size > 5 * 1024 * 1024){
    return json(400, "invalid_input", { message: "file_too_large_max_5mb" });
  }

  const ext = extFromType(mime);
  const mediaId = crypto.randomUUID();
  const key = `talent/${a.uid}/photo/${mediaId}.${ext}`;
  const buf = await file.arrayBuffer();

  await env.TALENT_MEDIA_BUCKET.put(key, buf, {
    httpMetadata: {
      contentType: mime
    }
  });

  const now = nowSec();

  await env.DB.prepare(`
    INSERT INTO talent_media (
      id, talent_id, media_type, storage_key, mime_type, file_size,
      width, height, duration_sec, sort_order, status, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 'active', ?, ?)
  `).bind(
    mediaId,
    a.uid,
    "photo",
    key,
    mime,
    size,
    JSON.stringify({
      original_name: String(file.name || ""),
      source: "project_invite_register"
    }),
    now
  ).run();

  return json(200, "ok", {
    uploaded: true,
    media_id: mediaId,
    storage_key: key,
    mime_type: mime,
    file_size: size
  });
}

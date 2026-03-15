import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

function canUpload(a){
  return hasRole(a.roles, ["super_admin","admin","staff"]);
}

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

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canUpload(a)) return json(403, "forbidden", null);

  if(!env.PROJECT_EVIDENCE_BUCKET){
    return json(500, "server_error", { message: "missing_r2_binding_PROJECT_EVIDENCE_BUCKET" });
  }

  const form = await request.formData();
  const files = form.getAll("files");
  const project_id = String(form.get("project_id") || "").trim();
  const attendance_date = String(form.get("attendance_date") || "").trim();
  const tag = String(form.get("tag") || "attendance").trim();

  if(!project_id) return json(400, "invalid_input", { message: "project_id_required" });
  if(!files || !files.length) return json(400, "invalid_input", { message: "files_required" });

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

      if(size > 8 * 1024 * 1024){
        errors.push({ name: String(file.name || ""), message: "file_too_large_max_8mb" });
        continue;
      }

      const id = crypto.randomUUID();
      const ext = extFromType(mime);
      const safeDate = attendance_date || new Date().toISOString().slice(0,10);
      const key = `projects/${project_id}/evidence/${safeDate}/${tag}/${id}.${ext}`;
      const buf = await file.arrayBuffer();

      await env.PROJECT_EVIDENCE_BUCKET.put(key, buf, {
        httpMetadata: { contentType: mime }
      });

      uploaded.push({
        id,
        key,
        mime_type: mime,
        file_size: size,
        uploaded_at: nowSec()
      });
    }catch(err){
      errors.push({ name: String(file?.name || ""), message: String(err?.message || err) });
    }
  }

  return json(200, "ok", {
    uploaded_count: uploaded.length,
    uploaded,
    errors
  });
}

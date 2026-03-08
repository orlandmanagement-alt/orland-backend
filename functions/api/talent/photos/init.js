import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function extFromName(name){
  const n = String(name||"").toLowerCase();
  const m = n.match(/\.([a-z0-9]{2,5})$/);
  const ext = m ? m[1] : "jpg";
  if(ext === "jpeg") return "jpg";
  if(!["jpg","png","webp"].includes(ext)) return "jpg";
  return ext;
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["talent"])) return json(403,"forbidden",{ message:"talent_only" });

  if(!env.R2) return json(500,"server_error",{ message:"missing_R2_binding" });

  const body = await readJson(request) || {};
  const kind = String(body.kind||"").trim(); // headshot|side|full|additional
  const filename = String(body.filename||"photo.jpg");
  const content_type = String(body.content_type||"image/jpeg");

  if(!["headshot","side","full","additional"].includes(kind)){
    return json(400,"invalid_input",{ message:"kind must be headshot|side|full|additional" });
  }

  const ext = extFromName(filename);
  const key = `talent/${a.uid}/${kind}/${crypto.randomUUID()}.${ext}`;
  const now = nowSec();

  // Feature-detect presign (not guaranteed on all runtimes)
  const canPresign = env.R2 && typeof env.R2.createPresignedUrl === "function";

  if(canPresign){
    try{
      const url = await env.R2.createPresignedUrl(key, { method:"PUT", expiresIn: 60 * 10, contentType: content_type });
      return json(200,"ok",{ object_key:key, upload_url:String(url), expires_in:600, need_put_proxy:false, now });
    }catch(e){
      // fallthrough to proxy mode
    }
  }

  return json(200,"ok",{ object_key:key, upload_url:null, expires_in:null, need_put_proxy:true, now });
}

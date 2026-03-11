import { json, readJson, requireAuth, hasRole } from "../../_lib.js";

function norm(v){
  return String(v || "").trim().toLowerCase();
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const slug = norm(body.slug);
  const exclude_id = String(body.exclude_id || "").trim();

  if(!slug){
    return json(400, "invalid_input", { message: "slug_required", available: false });
  }

  const candidates = [
    "posts",
    "blog_posts",
    "blogspot_posts"
  ];

  let found = null;
  for(const table of candidates){
    try{
      found = await env.DB.prepare(`
        SELECT id
        FROM ${table}
        WHERE lower(slug)=?
          AND (?='' OR id<>?)
        LIMIT 1
      `).bind(slug, exclude_id, exclude_id).first();
      if(found) break;
    }catch(_e){}
  }

  const available = !found;

  return json(200, "ok", {
    available,
    message: available ? "available" : "already_used"
  });
}

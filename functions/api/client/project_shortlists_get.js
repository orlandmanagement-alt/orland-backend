import { json, requireAuth } from "../../_lib.js";

function canAccessClient(roles){
  const set = new Set((roles || []).map(String));
  return set.has("client") || set.has("super_admin") || set.has("admin") || set.has("staff");
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessClient(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const url = new URL(request.url);
  const projectId = String(url.searchParams.get("project_id") || "").trim();

  let sql = `
    SELECT
      s.id,
      s.project_role_id,
      s.talent_user_id,
      s.status,
      s.created_at,
      pr.title AS role_title,
      p.id AS project_id,
      p.title AS project_title,
      u.display_name AS talent_name
    FROM project_shortlists s
    LEFT JOIN project_roles pr ON pr.id = s.project_role_id
    LEFT JOIN projects p ON p.id = pr.project_id
    LEFT JOIN users u ON u.id = s.talent_user_id
  `;
  const binds = [];

  if(projectId){
    sql += ` WHERE p.id = ? `;
    binds.push(projectId);
  }

  sql += ` ORDER BY s.created_at DESC LIMIT 100 `;

  try{
    const r = await env.DB.prepare(sql).bind(...binds).all();
    return json(200, "ok", {
      items: (r.results || []).map(row => ({
        id: row.id,
        project_id: row.project_id,
        project_title: row.project_title || "",
        project_role_id: row.project_role_id,
        role_title: row.role_title || "",
        talent_user_id: row.talent_user_id,
        talent_name: row.talent_name || "",
        status: row.status || "shortlisted",
        created_at: row.created_at || null
      }))
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_load_shortlists",
      detail: String(err?.message || err)
    });
  }
}

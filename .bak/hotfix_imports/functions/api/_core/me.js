import { json, requireAuth } from "../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const u = await env.DB.prepare(`
    SELECT id, email_norm, display_name, status, created_at, updated_at
    FROM users
    WHERE id=?
    LIMIT 1
  `).bind(a.uid).first();

  if(!u) return json(401, "unauthorized", null);
  if(String(u.status || "") !== "active") return json(403, "forbidden", { message:"user_inactive" });

  return json(200, "ok", {
    id: u.id,
    email_norm: u.email_norm,
    display_name: u.display_name,
    status: u.status,
    created_at: u.created_at,
    updated_at: u.updated_at,
    roles: Array.isArray(a.roles) ? a.roles : []
  });
}

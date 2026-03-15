import { json, requireAuth, hasRole } from "../../_lib.js";

async function ensureProjectsTables(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      client_name TEXT,
      owner_name TEXT,
      status TEXT,
      budget REAL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS project_talents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_label TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(project_id, user_id)
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS project_clients (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_label TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(project_id, user_id)
    )
  `).run();
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  await ensureProjectsTables(env);

  const url = new URL(request.url);
  const project_id = String(url.searchParams.get("project_id") || "").trim();
  if(!project_id) return json(400, "invalid_input", { message: "project_id" });

  const project = await env.DB.prepare(`
    SELECT id, code, name, client_name, owner_name, status, budget, start_date, end_date, created_at, updated_at
    FROM projects
    WHERE id=?
    LIMIT 1
  `).bind(project_id).first();

  if(!project) return json(404, "not_found", { message: "project_not_found" });

  const talents = await env.DB.prepare(`
    SELECT
      pt.id, pt.project_id, pt.user_id, pt.role_label, pt.status, pt.created_at, pt.updated_at,
      u.email_norm, u.display_name
    FROM project_talents pt
    JOIN users u ON u.id = pt.user_id
    WHERE pt.project_id=?
    ORDER BY pt.created_at ASC
  `).bind(project_id).all();

  const clients = await env.DB.prepare(`
    SELECT
      pc.id, pc.project_id, pc.user_id, pc.role_label, pc.status, pc.created_at, pc.updated_at,
      u.email_norm, u.display_name
    FROM project_clients pc
    JOIN users u ON u.id = pc.user_id
    WHERE pc.project_id=?
    ORDER BY pc.created_at ASC
  `).bind(project_id).all();

  const talent_pool = await env.DB.prepare(`
    SELECT u.id, u.email_norm, u.display_name
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles r ON r.id=ur.role_id
    WHERE r.name='talent' AND u.status='active'
    ORDER BY u.display_name ASC, u.email_norm ASC
  `).all();

  const client_pool = await env.DB.prepare(`
    SELECT u.id, u.email_norm, u.display_name
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles r ON r.id=ur.role_id
    WHERE r.name='client' AND u.status='active'
    ORDER BY u.display_name ASC, u.email_norm ASC
  `).all();

  return json(200, "ok", {
    project,
    talents: talents.results || [],
    clients: clients.results || [],
    talent_pool: talent_pool.results || [],
    client_pool: client_pool.results || []
  });
}

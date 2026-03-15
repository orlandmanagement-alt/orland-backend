import { json, requireAuth, hasRole } from "../../_lib.js";

async function ensureProjectsTable(env){
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
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  await ensureProjectsTable(env);

  const talent = await env.DB.prepare(`
    SELECT COUNT(DISTINCT u.id) AS total
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles r ON r.id=ur.role_id
    WHERE r.name='talent'
  `).first();

  const client = await env.DB.prepare(`
    SELECT COUNT(DISTINCT u.id) AS total
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles r ON r.id=ur.role_id
    WHERE r.name='client'
  `).first();

  const project = await env.DB.prepare(`
    SELECT COUNT(*) AS total FROM projects
  `).first();

  const active = await env.DB.prepare(`
    SELECT COUNT(*) AS total FROM projects WHERE status='active'
  `).first();

  const done = await env.DB.prepare(`
    SELECT COUNT(*) AS total FROM projects WHERE status='done'
  `).first();

  return json(200, "ok", {
    total_talent: Number(talent?.total || 0),
    total_client: Number(client?.total || 0),
    total_project: Number(project?.total || 0),
    active_project: Number(active?.total || 0),
    done_project: Number(done?.total || 0)
  });
}

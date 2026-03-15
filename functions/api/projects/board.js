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

  const r = await env.DB.prepare(`
    SELECT id, code, name, client_name, owner_name, status, updated_at, created_at
    FROM projects
    ORDER BY updated_at DESC, created_at DESC
  `).all();

  const columns = { draft: [], active: [], hold: [], done: [] };
  for(const row of (r.results || [])){
    const s = String(row.status || "draft").toLowerCase();
    if(!columns[s]) columns[s] = [];
    columns[s].push(row);
  }

  return json(200, "ok", { columns });
}

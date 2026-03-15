import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function ensureProjectsTables(env){
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

function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403, "forbidden", null);

  await ensureProjectsTables(env);

  const body = await readJson(request) || {};
  const action = String(body.action || "").trim();
  const project_id = String(body.project_id || "").trim();
  const user_id = String(body.user_id || "").trim();
  const role_label = String(body.role_label || "").trim();
  const now = nowSec();

  if(!project_id) return json(400, "invalid_input", { message: "project_id" });
  if(!user_id) return json(400, "invalid_input", { message: "user_id" });

  if(action === "add_talent"){
    const okUser = await env.DB.prepare(`
      SELECT 1 AS ok
      FROM user_roles ur
      JOIN roles r ON r.id=ur.role_id
      WHERE ur.user_id=? AND r.name='talent'
      LIMIT 1
    `).bind(user_id).first();
    if(!okUser) return json(400, "invalid_input", { message: "user_not_talent" });

    await env.DB.prepare(`
      INSERT INTO project_talents (id, project_id, user_id, role_label, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(project_id, user_id) DO UPDATE SET
        role_label=excluded.role_label,
        status='active',
        updated_at=excluded.updated_at
    `).bind(crypto.randomUUID(), project_id, user_id, role_label || null, now, now).run();

    return json(200, "ok", { assigned: true, kind: "talent" });
  }

  if(action === "remove_talent"){
    await env.DB.prepare(`
      DELETE FROM project_talents
      WHERE project_id=? AND user_id=?
    `).bind(project_id, user_id).run();

    return json(200, "ok", { removed: true, kind: "talent" });
  }

  if(action === "add_client"){
    const okUser = await env.DB.prepare(`
      SELECT 1 AS ok
      FROM user_roles ur
      JOIN roles r ON r.id=ur.role_id
      WHERE ur.user_id=? AND r.name='client'
      LIMIT 1
    `).bind(user_id).first();
    if(!okUser) return json(400, "invalid_input", { message: "user_not_client" });

    await env.DB.prepare(`
      INSERT INTO project_clients (id, project_id, user_id, role_label, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(project_id, user_id) DO UPDATE SET
        role_label=excluded.role_label,
        status='active',
        updated_at=excluded.updated_at
    `).bind(crypto.randomUUID(), project_id, user_id, role_label || null, now, now).run();

    return json(200, "ok", { assigned: true, kind: "client" });
  }

  if(action === "remove_client"){
    await env.DB.prepare(`
      DELETE FROM project_clients
      WHERE project_id=? AND user_id=?
    `).bind(project_id, user_id).run();

    return json(200, "ok", { removed: true, kind: "client" });
  }

  return json(400, "invalid_input", { message: "unknown_action" });
}

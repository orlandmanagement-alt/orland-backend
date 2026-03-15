import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

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

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403, "forbidden", null);

  await ensureProjectsTables(env);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const like = q ? "%" + q + "%" : null;

  const r = await env.DB.prepare(`
    SELECT
      p.id, p.code, p.name, p.client_name, p.owner_name, p.status, p.budget,
      p.start_date, p.end_date, p.created_at, p.updated_at,
      (SELECT COUNT(*) FROM project_talents pt WHERE pt.project_id=p.id AND pt.status='active') AS talent_count,
      (SELECT COUNT(*) FROM project_clients pc WHERE pc.project_id=p.id AND pc.status='active') AS client_count
    FROM projects p
    WHERE
      (? IS NULL OR p.code LIKE ? OR p.name LIKE ? OR p.client_name LIKE ? OR p.owner_name LIKE ?)
      AND (? = '' OR p.status = ?)
    ORDER BY p.updated_at DESC, p.created_at DESC
  `).bind(like, like, like, like, like, status, status).all();

  return json(200, "ok", { items: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403, "forbidden", null);

  await ensureProjectsTables(env);

  const body = await readJson(request) || {};
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim();
  const client_name = String(body.client_name || "").trim();
  const owner_name = String(body.owner_name || "").trim();
  const status = String(body.status || "draft").trim().toLowerCase();
  const budget = Number(body.budget || 0);
  const start_date = String(body.start_date || "").trim();
  const end_date = String(body.end_date || "").trim();
  const now = nowSec();

  if(!code) return json(400, "invalid_input", { message: "code" });
  if(!name) return json(400, "invalid_input", { message: "name" });
  if(!["draft","active","hold","done"].includes(status)) return json(400, "invalid_input", { message: "status" });

  const used = await env.DB.prepare("SELECT 1 AS ok FROM projects WHERE code=? LIMIT 1").bind(code).first();
  if(used) return json(409, "conflict", { message: "code_used" });

  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO projects (
      id, code, name, client_name, owner_name, status, budget,
      start_date, end_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, code, name, client_name, owner_name, status, budget, start_date || null, end_date || null, now, now).run();

  return json(200, "ok", { created: true, project_id: id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403, "forbidden", null);

  await ensureProjectsTables(env);

  const body = await readJson(request) || {};
  const action = String(body.action || "update");
  const project_id = String(body.project_id || "").trim();
  const now = nowSec();

  if(!project_id) return json(400, "invalid_input", { message: "project_id" });

  if(action === "update"){
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const client_name = String(body.client_name || "").trim();
    const owner_name = String(body.owner_name || "").trim();
    const status = String(body.status || "draft").trim().toLowerCase();
    const budget = Number(body.budget || 0);
    const start_date = String(body.start_date || "").trim();
    const end_date = String(body.end_date || "").trim();

    if(!code) return json(400, "invalid_input", { message: "code" });
    if(!name) return json(400, "invalid_input", { message: "name" });
    if(!["draft","active","hold","done"].includes(status)) return json(400, "invalid_input", { message: "status" });

    const conflict = await env.DB.prepare(
      "SELECT id FROM projects WHERE code=? AND id<>? LIMIT 1"
    ).bind(code, project_id).first();
    if(conflict) return json(409, "conflict", { message: "code_used" });

    await env.DB.prepare(`
      UPDATE projects
      SET code=?, name=?, client_name=?, owner_name=?, status=?, budget=?,
          start_date=?, end_date=?, updated_at=?
      WHERE id=?
    `).bind(code, name, client_name, owner_name, status, budget, start_date || null, end_date || null, now, project_id).run();

    return json(200, "ok", { updated: true });
  }

  if(action === "delete"){
    await env.DB.prepare("DELETE FROM project_talents WHERE project_id=?").bind(project_id).run();
    await env.DB.prepare("DELETE FROM project_clients WHERE project_id=?").bind(project_id).run();
    await env.DB.prepare("DELETE FROM projects WHERE id=?").bind(project_id).run();
    return json(200, "ok", { deleted: true });
  }

  return json(400, "invalid_input", { message: "unknown_action" });
}

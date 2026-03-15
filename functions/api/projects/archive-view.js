import { json, requireAuth, hasRole } from "../../_lib.js";

async function ensureTables(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS project_attendance (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_role_id TEXT,
      talent_user_id TEXT NOT NULL,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'present',
      checkin_at INTEGER,
      checkout_at INTEGER,
      evidence_json TEXT NOT NULL DEFAULT '{}',
      approved_by_user_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS project_certificates (
      id TEXT PRIMARY KEY,
      certificate_no TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      project_role_id TEXT,
      talent_user_id TEXT NOT NULL,
      template_id TEXT,
      template_snapshot_json TEXT NOT NULL DEFAULT '{}',
      issued_to_name TEXT NOT NULL,
      project_title TEXT NOT NULL,
      role_title TEXT,
      organization_name TEXT,
      issue_date TEXT NOT NULL,
      event_date_start TEXT,
      event_date_end TEXT,
      city TEXT,
      description_formal TEXT NOT NULL,
      signer_name TEXT,
      signer_title TEXT,
      verification_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'issued',
      source_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS talent_credits (
      id TEXT PRIMARY KEY,
      talent_id TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT,
      credit_month TEXT,
      credit_year INTEGER,
      about TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
}

function canRead(a){
  return hasRole(a.roles, ["super_admin","admin","staff","client"]);
}

function safeJson(v){
  try{ return JSON.parse(v || "{}"); }catch{ return {}; }
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403, "forbidden", null);

  await ensureTables(env);

  const url = new URL(request.url);
  const project_id = String(url.searchParams.get("project_id") || "").trim();

  if(!project_id){
    const list = await env.DB.prepare(`
      SELECT
        p.id,
        p.title,
        p.status,
        p.location_text,
        p.updated_at,
        o.name AS organization_name,
        (SELECT COUNT(*) FROM project_attendance pa WHERE pa.project_id = p.id AND pa.status='present') AS attendance_count,
        (SELECT COUNT(*) FROM project_certificates pc WHERE pc.project_id = p.id) AS certificate_count
      FROM projects p
      LEFT JOIN organizations o ON o.id = p.organization_id
      WHERE p.status='archived'
      ORDER BY p.updated_at DESC, p.created_at DESC
      LIMIT 200
    `).all();

    return json(200, "ok", {
      projects: list.results || []
    });
  }

  const project = await env.DB.prepare(`
    SELECT
      p.id,
      p.title,
      p.status,
      p.location_text,
      p.description,
      p.project_type,
      p.created_at,
      p.updated_at,
      o.name AS organization_name
    FROM projects p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id=?
    LIMIT 1
  `).bind(project_id).first();

  if(!project) return json(404, "not_found", { message: "project_not_found" });

  const attendanceRows = await env.DB.prepare(`
    SELECT
      pa.id,
      pa.project_role_id,
      pa.talent_user_id,
      pa.attendance_date,
      pa.status,
      pa.evidence_json,
      pa.created_at,
      u.display_name,
      pr.role_name
    FROM project_attendance pa
    LEFT JOIN users u ON u.id = pa.talent_user_id
    LEFT JOIN project_roles pr ON pr.id = pa.project_role_id
    WHERE pa.project_id=?
    ORDER BY pa.attendance_date DESC, u.display_name ASC
  `).bind(project_id).all();

  const certificates = await env.DB.prepare(`
    SELECT
      id,
      certificate_no,
      talent_user_id,
      issued_to_name,
      role_title,
      issue_date,
      verification_code,
      status,
      created_at
    FROM project_certificates
    WHERE project_id=?
    ORDER BY created_at DESC
  `).bind(project_id).all();

  const talentIds = Array.from(new Set((attendanceRows.results || []).map(x => String(x.talent_user_id || "")).filter(Boolean)));

  let credits = [];
  if(talentIds.length){
    const placeholders = talentIds.map(() => "?").join(",");
    const stmt = `
      SELECT
        id,
        talent_id,
        title,
        company,
        credit_month,
        credit_year,
        about,
        updated_at
      FROM talent_credits
      WHERE talent_id IN (${placeholders})
      ORDER BY updated_at DESC, created_at DESC
    `;
    const r = await env.DB.prepare(stmt).bind(...talentIds).all();
    credits = r.results || [];
  }

  return json(200, "ok", {
    project,
    attendance: (attendanceRows.results || []).map(x => ({
      ...x,
      evidence: safeJson(x.evidence_json)
    })),
    certificates: certificates.results || [],
    credits
  });
}

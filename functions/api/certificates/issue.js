import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function ensureTables(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS certificate_templates (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      mode TEXT NOT NULL DEFAULT 'html',
      html_template TEXT NOT NULL DEFAULT '',
      css_template TEXT NOT NULL DEFAULT '',
      background_url TEXT,
      page_width TEXT NOT NULL DEFAULT 'A4-landscape',
      is_default INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_by_user_id TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_project_certificates_project
    ON project_certificates(project_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_project_certificates_talent
    ON project_certificates(talent_user_id)
  `).run();
}

function canIssue(a){
  return hasRole(a.roles, ["super_admin","admin","staff"]);
}

function ymdNow(){
  return new Date().toISOString().slice(0, 10);
}

function pad6(n){
  return String(n).padStart(6, "0");
}

function randCode(len = 8){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for(let i=0;i<len;i++) out += chars[arr[i] % chars.length];
  return out;
}

async function nextCertificateNo(env){
  const year = new Date().getFullYear();
  const prefix = `OM-CERT-${year}-`;
  const r = await env.DB.prepare(`
    SELECT certificate_no
    FROM project_certificates
    WHERE certificate_no LIKE ?
    ORDER BY certificate_no DESC
    LIMIT 1
  `).bind(prefix + "%").first();

  let seq = 1;
  if(r?.certificate_no){
    const last = String(r.certificate_no).split("-").pop();
    const n = Number(last || 0);
    if(n > 0) seq = n + 1;
  }
  return prefix + pad6(seq);
}

async function uniqueVerificationCode(env){
  for(let i=0;i<10;i++){
    const code = randCode(8);
    const row = await env.DB.prepare(`SELECT 1 AS ok FROM project_certificates WHERE verification_code=? LIMIT 1`).bind(code).first();
    if(!row) return code;
  }
  return randCode(12);
}

function formalDescription({
  name,
  role,
  project,
  organization,
  event_date_start,
  event_date_end,
  city
}){
  const period = [event_date_start, event_date_end].filter(Boolean).join(" until ");
  return `This certificate is hereby awarded to ${name} in recognition of professional participation as ${role || "Talent"} in the project ${project} under ${organization || "Orland Management"}${period ? ` during the period ${period}` : ""}${city ? ` in ${city}` : ""}. The named participant has been recorded as present and has carried out assigned responsibilities in accordance with operational standards established by Orland Management.`;
}

async function loadTemplate(env, templateId){
  if(templateId){
    const row = await env.DB.prepare(`
      SELECT *
      FROM certificate_templates
      WHERE id=? AND status='active'
      LIMIT 1
    `).bind(templateId).first();
    if(row) return row;
  }

  const def = await env.DB.prepare(`
    SELECT *
    FROM certificate_templates
    WHERE is_default=1 AND status='active'
    LIMIT 1
  `).first();
  return def || null;
}

async function loadIssueRows(env, projectId, projectRoleId, talentIds){
  if(projectRoleId){
    const r = await env.DB.prepare(`
      SELECT
        p.id AS project_id,
        p.title AS project_title,
        p.location_text AS city,
        p.owner_user_id,
        pr.id AS project_role_id,
        pr.role_name AS role_title,
        u.id AS talent_user_id,
        u.display_name AS issued_to_name,
        o.name AS organization_name
      FROM project_roles pr
      JOIN projects p ON p.id = pr.project_id
      JOIN project_bookings pb ON pb.project_role_id = pr.id
      JOIN users u ON u.id = pb.talent_user_id
      LEFT JOIN organizations o ON o.id = p.organization_id
      WHERE pr.id = ?
        AND pb.status IN ('approved','confirmed','completed','active')
      ORDER BY u.display_name ASC
    `).bind(projectRoleId).all();

    let rows = r.results || [];
    if(Array.isArray(talentIds) && talentIds.length){
      const set = new Set(talentIds.map(String));
      rows = rows.filter(x => set.has(String(x.talent_user_id)));
    }
    return rows;
  }

  const r = await env.DB.prepare(`
    SELECT
      p.id AS project_id,
      p.title AS project_title,
      p.location_text AS city,
      p.owner_user_id,
      pr.id AS project_role_id,
      pr.role_name AS role_title,
      u.id AS talent_user_id,
      u.display_name AS issued_to_name,
      o.name AS organization_name
    FROM projects p
    JOIN project_roles pr ON pr.project_id = p.id
    JOIN project_bookings pb ON pb.project_role_id = pr.id
    JOIN users u ON u.id = pb.talent_user_id
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = ?
      AND pb.status IN ('approved','confirmed','completed','active')
    ORDER BY pr.role_name ASC, u.display_name ASC
  `).bind(projectId).all();

  let rows = r.results || [];
  if(Array.isArray(talentIds) && talentIds.length){
    const set = new Set(talentIds.map(String));
    rows = rows.filter(x => set.has(String(x.talent_user_id)));
  }
  return rows;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canIssue(a)) return json(403, "forbidden", null);

  await ensureTables(env);

  const url = new URL(request.url);
  const project_id = String(url.searchParams.get("project_id") || "").trim();
  const talent_user_id = String(url.searchParams.get("talent_user_id") || "").trim();

  if(project_id){
    const r = await env.DB.prepare(`
      SELECT
        pc.id,
        pc.certificate_no,
        pc.project_id,
        pc.project_role_id,
        pc.talent_user_id,
        pc.issued_to_name,
        pc.project_title,
        pc.role_title,
        pc.organization_name,
        pc.issue_date,
        pc.status,
        pc.verification_code,
        pc.created_at
      FROM project_certificates pc
      WHERE pc.project_id=?
        AND (?='' OR pc.talent_user_id=?)
      ORDER BY pc.created_at DESC
    `).bind(project_id, talent_user_id, talent_user_id).all();

    return json(200, "ok", { items: r.results || [] });
  }

  const recent = await env.DB.prepare(`
    SELECT
      pc.id,
      pc.certificate_no,
      pc.project_id,
      pc.project_role_id,
      pc.talent_user_id,
      pc.issued_to_name,
      pc.project_title,
      pc.role_title,
      pc.organization_name,
      pc.issue_date,
      pc.status,
      pc.verification_code,
      pc.created_at
    FROM project_certificates pc
    ORDER BY pc.created_at DESC
    LIMIT 200
  `).all();

  return json(200, "ok", { items: recent.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canIssue(a)) return json(403, "forbidden", null);

  await ensureTables(env);

  const body = await readJson(request) || {};
  const action = String(body.action || "issue").trim();
  const now = nowSec();

  if(action !== "issue"){
    return json(400, "invalid_input", { message: "unknown_action" });
  }

  const project_id = String(body.project_id || "").trim();
  const project_role_id = String(body.project_role_id || "").trim();
  const template_id = String(body.template_id || "").trim();
  const signer_name = String(body.signer_name || "Orland Management").trim();
  const signer_title = String(body.signer_title || "Project Director").trim();
  const event_date_start = String(body.event_date_start || "").trim() || null;
  const event_date_end = String(body.event_date_end || "").trim() || null;
  const city_override = String(body.city || "").trim() || null;
  const talent_user_ids = Array.isArray(body.talent_user_ids) ? body.talent_user_ids.map(String).filter(Boolean) : [];

  if(!project_id && !project_role_id){
    return json(400, "invalid_input", { message: "project_id_or_project_role_id_required" });
  }

  const template = await loadTemplate(env, template_id);
  if(!template){
    return json(400, "invalid_input", { message: "template_not_found_or_no_default_template" });
  }

  const rows = await loadIssueRows(env, project_id, project_role_id, talent_user_ids);
  if(!rows.length){
    return json(404, "not_found", { message: "no_eligible_talent_found" });
  }

  const issued = [];
  const skipped = [];

  for(const row of rows){
    const exists = await env.DB.prepare(`
      SELECT id, certificate_no
      FROM project_certificates
      WHERE project_id=? AND project_role_id IS ? AND talent_user_id=?
      LIMIT 1
    `).bind(
      String(row.project_id),
      row.project_role_id == null ? null : String(row.project_role_id),
      String(row.talent_user_id)
    ).first();

    if(exists){
      skipped.push({
        talent_user_id: row.talent_user_id,
        issued_to_name: row.issued_to_name,
        reason: "already_issued",
        certificate_no: exists.certificate_no
      });
      continue;
    }

    const id = crypto.randomUUID();
    const certificate_no = await nextCertificateNo(env);
    const verification_code = await uniqueVerificationCode(env);
    const issue_date = ymdNow();
    const city = city_override || row.city || null;
    const desc = formalDescription({
      name: row.issued_to_name,
      role: row.role_title,
      project: row.project_title,
      organization: row.organization_name || "Orland Management",
      event_date_start,
      event_date_end,
      city
    });

    const template_snapshot_json = JSON.stringify({
      id: template.id,
      code: template.code,
      name: template.name,
      mode: template.mode,
      html_template: template.html_template,
      css_template: template.css_template,
      background_url: template.background_url,
      page_width: template.page_width,
      snapshotted_at: now
    });

    const verification_url = `/certificate/verify?certificate_no=${encodeURIComponent(certificate_no)}&code=${encodeURIComponent(verification_code)}`;

    await env.DB.prepare(`
      INSERT INTO project_certificates (
        id, certificate_no, project_id, project_role_id, talent_user_id,
        template_id, template_snapshot_json,
        issued_to_name, project_title, role_title, organization_name,
        issue_date, event_date_start, event_date_end, city,
        description_formal, signer_name, signer_title,
        verification_code, status, source_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)
    `).bind(
      id,
      certificate_no,
      row.project_id,
      row.project_role_id || null,
      row.talent_user_id,
      template.id,
      template_snapshot_json,
      row.issued_to_name,
      row.project_title,
      row.role_title || null,
      row.organization_name || "Orland Management",
      issue_date,
      event_date_start,
      event_date_end,
      city,
      desc,
      signer_name,
      signer_title,
      verification_code,
      JSON.stringify({
        verification_url,
        issued_by_user_id: a.uid
      }),
      now,
      now
    ).run();

    issued.push({
      id,
      certificate_no,
      verification_code,
      verification_url,
      talent_user_id: row.talent_user_id,
      issued_to_name: row.issued_to_name,
      project_title: row.project_title,
      role_title: row.role_title
    });
  }

  return json(200, "ok", {
    issued_count: issued.length,
    skipped_count: skipped.length,
    issued,
    skipped
  });
}

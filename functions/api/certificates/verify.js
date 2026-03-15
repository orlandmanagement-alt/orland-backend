import { json } from "../../_lib.js";

async function ensureTables(env){
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
}

export async function onRequestGet({ request, env }){
  await ensureTables(env);

  const url = new URL(request.url);
  const certificate_no = String(url.searchParams.get("certificate_no") || "").trim();
  const code = String(url.searchParams.get("code") || "").trim();

  if(!certificate_no && !code){
    return json(400, "invalid_input", { message: "certificate_no_or_code_required" });
  }

  const row = await env.DB.prepare(`
    SELECT
      certificate_no,
      project_title,
      role_title,
      issued_to_name,
      organization_name,
      issue_date,
      event_date_start,
      event_date_end,
      city,
      signer_name,
      signer_title,
      verification_code,
      status
    FROM project_certificates
    WHERE (? <> '' AND certificate_no = ?)
       OR (? <> '' AND verification_code = ?)
    LIMIT 1
  `).bind(certificate_no, certificate_no, code, code).first();

  if(!row){
    return json(200, "ok", {
      valid: false,
      message: "Certificate not found"
    });
  }

  return json(200, "ok", {
    valid: true,
    item: row
  });
}

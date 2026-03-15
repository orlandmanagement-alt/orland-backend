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

function escHtml(v){
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replaceVars(txt, vars){
  let out = String(txt || "");
  for(const [k, v] of Object.entries(vars || {})){
    const re = new RegExp("\\{\\{" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\}\\}", "g");
    out = out.replace(re, escHtml(String(v ?? "")));
  }
  return out;
}

function certVars(row, sourceJson){
  const verificationUrl =
    sourceJson?.verification_url ||
    `/certificate/verify?certificate_no=${encodeURIComponent(row.certificate_no || "")}&code=${encodeURIComponent(row.verification_code || "")}`;

  return {
    name: row.issued_to_name || "",
    role: row.role_title || "",
    project: row.project_title || "",
    organization: row.organization_name || "",
    certificate_no: row.certificate_no || "",
    issue_date: row.issue_date || "",
    event_date_start: row.event_date_start || "",
    event_date_end: row.event_date_end || "",
    city: row.city || "",
    description_formal: row.description_formal || "",
    signer_name: row.signer_name || "",
    signer_title: row.signer_title || "",
    verification_url: verificationUrl
  };
}

function defaultHtml(){
  return `
<div class="cert-page">
  <div class="cert-bg"></div>
  <div class="cert-inner">
    <div class="cert-brand">Orland Management</div>
    <div class="cert-title">CERTIFICATE OF PROJECT EXPERIENCE</div>
    <div class="cert-no">Certificate No: {{certificate_no}}</div>
    <div class="cert-line">This certificate is proudly presented to</div>
    <div class="cert-name">{{name}}</div>
    <div class="cert-desc">{{description_formal}}</div>
    <div class="cert-meta">
      <div><strong>Role:</strong> {{role}}</div>
      <div><strong>Project:</strong> {{project}}</div>
      <div><strong>Organization:</strong> {{organization}}</div>
      <div><strong>Issue Date:</strong> {{issue_date}}</div>
      <div><strong>Project Period:</strong> {{event_date_start}} - {{event_date_end}}</div>
      <div><strong>City:</strong> {{city}}</div>
    </div>
    <div class="cert-footer">
      <div class="sign-block">
        <div class="sign-line"></div>
        <div class="sign-name">{{signer_name}}</div>
        <div class="sign-title">{{signer_title}}</div>
      </div>
      <div class="verify-block">
        <div>Verification</div>
        <div>{{verification_url}}</div>
      </div>
    </div>
  </div>
</div>
  `.trim();
}

function defaultCss(){
  return `
.cert-page{position:relative;width:1123px;min-height:794px;background:#fff;color:#111827;overflow:hidden;font-family:Georgia,"Times New Roman",serif}
.cert-bg{position:absolute;inset:20px;border:8px solid #c8a96b;box-shadow:inset 0 0 0 2px #e9d7b0;pointer-events:none}
.cert-inner{position:relative;padding:70px 90px;text-align:center}
.cert-brand{font-size:22px;font-weight:700;letter-spacing:.08em;color:#6b4f1d;margin-bottom:18px}
.cert-title{font-size:40px;font-weight:700;letter-spacing:.08em;margin-bottom:10px}
.cert-no{font-size:14px;color:#6b7280;margin-bottom:40px}
.cert-line{font-size:20px;color:#4b5563}
.cert-name{margin-top:18px;font-size:44px;font-weight:700;color:#7c3aed;line-height:1.15}
.cert-desc{margin:28px auto 0;max-width:820px;font-size:20px;line-height:1.7;color:#1f2937}
.cert-meta{margin:36px auto 0;max-width:760px;display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;text-align:left;font-size:16px}
.cert-footer{margin-top:56px;display:flex;justify-content:space-between;align-items:flex-end;gap:30px}
.sign-block{width:320px;text-align:center}
.sign-line{border-top:2px solid #111827;margin-bottom:8px}
.sign-name{font-size:18px;font-weight:700}
.sign-title{font-size:14px;color:#6b7280}
.verify-block{text-align:right;max-width:340px;font-size:13px;color:#4b5563;word-break:break-word}
@media print{
  html,body{margin:0;padding:0;background:#fff}
}
  `.trim();
}

export async function onRequestGet({ request, env }){
  await ensureTables(env);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  const certificate_no = String(url.searchParams.get("certificate_no") || "").trim();
  const code = String(url.searchParams.get("code") || "").trim();

  if(!id && !certificate_no && !code){
    return json(400, "invalid_input", { message: "id_or_certificate_no_or_code_required" });
  }

  const row = await env.DB.prepare(`
    SELECT *
    FROM project_certificates
    WHERE (? <> '' AND id = ?)
       OR (? <> '' AND certificate_no = ?)
       OR (? <> '' AND verification_code = ?)
    LIMIT 1
  `).bind(id, id, certificate_no, certificate_no, code, code).first();

  if(!row){
    return json(404, "not_found", { message: "certificate_not_found" });
  }

  let snapshot = {};
  let sourceJson = {};
  try{ snapshot = JSON.parse(row.template_snapshot_json || "{}"); }catch{}
  try{ sourceJson = JSON.parse(row.source_json || "{}"); }catch{}

  const vars = certVars(row, sourceJson);
  const htmlTemplate = snapshot.html_template || defaultHtml();
  const cssTemplate = snapshot.css_template || defaultCss();
  const backgroundUrl = snapshot.background_url || "";

  const renderedHtml = replaceVars(htmlTemplate, vars);
  const renderedCss = replaceVars(cssTemplate, vars);

  const documentHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
html,body{margin:0;padding:0;background:#e5e7eb}
.doc-wrap{padding:24px;display:flex;justify-content:center}
.doc-card{background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.08)}
${renderedCss}
${backgroundUrl ? `.cert-page{background-image:url('${backgroundUrl}');background-size:cover;background-position:center;background-repeat:no-repeat}` : ""}
</style>
</head>
<body>
<div class="doc-wrap">
  <div class="doc-card">${renderedHtml}</div>
</div>
</body>
</html>
  `.trim();

  return json(200, "ok", {
    item: {
      id: row.id,
      certificate_no: row.certificate_no,
      verification_code: row.verification_code,
      issued_to_name: row.issued_to_name,
      project_title: row.project_title,
      role_title: row.role_title,
      issue_date: row.issue_date,
      status: row.status
    },
    vars,
    html: renderedHtml,
    css: renderedCss,
    background_url: backgroundUrl,
    document_html: documentHtml
  });
}

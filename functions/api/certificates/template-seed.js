import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

const DEFAULT_HTML = `
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

const DEFAULT_CSS = `
.cert-page{position:relative;width:1123px;min-height:794px;background:#fff;color:#111827;overflow:hidden;font-family:Georgia, "Times New Roman", serif;}
.cert-bg{position:absolute;inset:20px;border:8px solid #c8a96b;box-shadow:inset 0 0 0 2px #e9d7b0;pointer-events:none;}
.cert-inner{position:relative;padding:70px 90px;text-align:center;}
.cert-brand{font-size:22px;font-weight:700;letter-spacing:.08em;color:#6b4f1d;margin-bottom:18px;}
.cert-title{font-size:40px;font-weight:700;letter-spacing:.08em;margin-bottom:10px;}
.cert-no{font-size:14px;color:#6b7280;margin-bottom:40px;}
.cert-line{font-size:20px;color:#4b5563;}
.cert-name{margin-top:18px;font-size:44px;font-weight:700;color:#7c3aed;}
.cert-desc{margin:28px auto 0;max-width:820px;font-size:20px;line-height:1.7;color:#1f2937;}
.cert-meta{margin:36px auto 0;max-width:760px;display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;text-align:left;font-size:16px;}
.cert-footer{margin-top:56px;display:flex;justify-content:space-between;align-items:flex-end;gap:30px;}
.sign-block{width:320px;text-align:center;}
.sign-line{border-top:2px solid #111827;margin-bottom:8px;}
.sign-name{font-size:18px;font-weight:700;}
.sign-title{font-size:14px;color:#6b7280;}
.verify-block{text-align:right;max-width:340px;font-size:13px;color:#4b5563;word-break:break-word;}
`.trim();

async function ensureTable(env){
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
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403, "forbidden", null);

  await ensureTable(env);

  const row = await env.DB.prepare(`SELECT id FROM certificate_templates WHERE code='default_formal' LIMIT 1`).first();
  if(row) return json(200, "ok", { seeded: false, exists: true });

  const now = nowSec();
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO certificate_templates (
      id, code, name, description, mode, html_template, css_template,
      background_url, page_width, is_default, status, created_by_user_id, created_at, updated_at
    ) VALUES (?, 'default_formal', 'Default Formal Certificate', ?, 'html', ?, ?, NULL, 'A4-landscape', 1, 'active', ?, ?, ?)
  `).bind(
    id,
    "Template formal default untuk sertifikat pengalaman project",
    DEFAULT_HTML,
    DEFAULT_CSS,
    a.uid,
    now,
    now
  ).run();

  return json(200, "ok", { seeded: true, id });
}

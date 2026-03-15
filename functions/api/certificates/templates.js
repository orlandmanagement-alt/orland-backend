import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

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

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_certificate_templates_status
    ON certificate_templates(status)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_certificate_templates_default
    ON certificate_templates(is_default)
  `).run();
}

function canManage(a){
  return hasRole(a.roles, ["super_admin"]);
}

function canRead(a){
  return hasRole(a.roles, ["super_admin","admin","staff"]);
}

const DEFAULT_HTML = `
<div class="cert-page">
  <div class="cert-bg"></div>
  <div class="cert-inner">
    <div class="cert-brand">Orland Management</div>
    <div class="cert-title">CERTIFICATE OF PROJECT EXPERIENCE</div>
    <div class="cert-no">Certificate No: {{certificate_no}}</div>

    <div class="cert-line">This certificate is proudly presented to</div>
    <div class="cert-name">{{name}}</div>

    <div class="cert-desc">
      {{description_formal}}
    </div>

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
.cert-page{
  position:relative;
  width:1123px;
  min-height:794px;
  background:#fff;
  color:#111827;
  overflow:hidden;
  font-family:Georgia, "Times New Roman", serif;
}
.cert-bg{
  position:absolute;
  inset:20px;
  border:8px solid #c8a96b;
  box-shadow:inset 0 0 0 2px #e9d7b0;
  pointer-events:none;
}
.cert-inner{
  position:relative;
  padding:70px 90px;
  text-align:center;
}
.cert-brand{
  font-size:22px;
  font-weight:700;
  letter-spacing:.08em;
  color:#6b4f1d;
  margin-bottom:18px;
}
.cert-title{
  font-size:40px;
  font-weight:700;
  letter-spacing:.08em;
  margin-bottom:10px;
}
.cert-no{
  font-size:14px;
  color:#6b7280;
  margin-bottom:40px;
}
.cert-line{
  font-size:20px;
  color:#4b5563;
}
.cert-name{
  margin-top:18px;
  font-size:44px;
  font-weight:700;
  color:#7c3aed;
}
.cert-desc{
  margin:28px auto 0;
  max-width:820px;
  font-size:20px;
  line-height:1.7;
  color:#1f2937;
}
.cert-meta{
  margin:36px auto 0;
  max-width:760px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px 18px;
  text-align:left;
  font-size:16px;
}
.cert-footer{
  margin-top:56px;
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap:30px;
}
.sign-block{
  width:320px;
  text-align:center;
}
.sign-line{
  border-top:2px solid #111827;
  margin-bottom:8px;
}
.sign-name{
  font-size:18px;
  font-weight:700;
}
.sign-title{
  font-size:14px;
  color:#6b7280;
}
.verify-block{
  text-align:right;
  max-width:340px;
  font-size:13px;
  color:#4b5563;
  word-break:break-word;
}
`.trim();

function normalizeRow(row){
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    mode: row.mode,
    html_template: row.html_template,
    css_template: row.css_template,
    background_url: row.background_url,
    page_width: row.page_width,
    is_default: Number(row.is_default || 0),
    status: row.status,
    created_by_user_id: row.created_by_user_id,
    created_at: Number(row.created_at || 0),
    updated_at: Number(row.updated_at || 0)
  };
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403, "forbidden", null);

  await ensureTable(env);

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  const code = String(url.searchParams.get("code") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();

  if(id || code){
    const row = await env.DB.prepare(`
      SELECT *
      FROM certificate_templates
      WHERE (? <> '' AND id = ?) OR (? <> '' AND code = ?)
      LIMIT 1
    `).bind(id, id, code, code).first();

    if(!row) return json(404, "not_found", { message: "template_not_found" });
    return json(200, "ok", { item: normalizeRow(row) });
  }

  const r = await env.DB.prepare(`
    SELECT *
    FROM certificate_templates
    WHERE (? = '' OR status = ?)
    ORDER BY is_default DESC, updated_at DESC, created_at DESC
  `).bind(status, status).all();

  return json(200, "ok", { items: (r.results || []).map(normalizeRow) });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403, "forbidden", null);

  await ensureTable(env);

  const body = await readJson(request) || {};
  const action = String(body.action || "create").trim();
  const now = nowSec();

  if(action === "seed_default"){
    const row = await env.DB.prepare(`
      SELECT id
      FROM certificate_templates
      WHERE code='default_formal'
      LIMIT 1
    `).first();

    if(row){
      return json(200, "ok", { seeded: false, exists: true });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO certificate_templates (
        id, code, name, description, mode, html_template, css_template,
        background_url, page_width, is_default, status, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'html', ?, ?, NULL, 'A4-landscape', 1, 'active', ?, ?, ?)
    `).bind(
      id,
      "default_formal",
      "Default Formal Certificate",
      "Template default formal sertifikat pengalaman project",
      DEFAULT_HTML,
      DEFAULT_CSS,
      a.uid,
      now,
      now
    ).run();

    return json(200, "ok", { seeded: true, id });
  }

  if(action === "create"){
    const id = crypto.randomUUID();
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const mode = String(body.mode || "html").trim() || "html";
    const html_template = String(body.html_template || "").trim() || DEFAULT_HTML;
    const css_template = String(body.css_template || "").trim() || DEFAULT_CSS;
    const background_url = String(body.background_url || "").trim() || null;
    const page_width = String(body.page_width || "A4-landscape").trim() || "A4-landscape";
    const is_default = body.is_default ? 1 : 0;
    const status = String(body.status || "active").trim() || "active";

    if(!code) return json(400, "invalid_input", { message: "code" });
    if(!name) return json(400, "invalid_input", { message: "name" });

    if(is_default){
      await env.DB.prepare(`UPDATE certificate_templates SET is_default=0, updated_at=? WHERE is_default=1`).bind(now).run();
    }

    await env.DB.prepare(`
      INSERT INTO certificate_templates (
        id, code, name, description, mode, html_template, css_template,
        background_url, page_width, is_default, status, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, code, name, description || null, mode,
      html_template, css_template, background_url, page_width,
      is_default, status, a.uid, now, now
    ).run();

    return json(200, "ok", { created: true, id });
  }

  if(action === "update"){
    const id = String(body.id || "").trim();
    if(!id) return json(400, "invalid_input", { message: "id" });

    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const mode = String(body.mode || "html").trim() || "html";
    const html_template = String(body.html_template || "").trim();
    const css_template = String(body.css_template || "").trim();
    const background_url = String(body.background_url || "").trim() || null;
    const page_width = String(body.page_width || "A4-landscape").trim() || "A4-landscape";
    const is_default = body.is_default ? 1 : 0;
    const status = String(body.status || "active").trim() || "active";

    if(!code) return json(400, "invalid_input", { message: "code" });
    if(!name) return json(400, "invalid_input", { message: "name" });

    if(is_default){
      await env.DB.prepare(`UPDATE certificate_templates SET is_default=0, updated_at=? WHERE is_default=1 AND id<>?`).bind(now, id).run();
    }

    await env.DB.prepare(`
      UPDATE certificate_templates
      SET code=?, name=?, description=?, mode=?, html_template=?, css_template=?,
          background_url=?, page_width=?, is_default=?, status=?, updated_at=?
      WHERE id=?
    `).bind(
      code, name, description || null, mode, html_template, css_template,
      background_url, page_width, is_default, status, now, id
    ).run();

    return json(200, "ok", { updated: true });
  }

  if(action === "set_default"){
    const id = String(body.id || "").trim();
    if(!id) return json(400, "invalid_input", { message: "id" });

    await env.DB.prepare(`UPDATE certificate_templates SET is_default=0, updated_at=? WHERE is_default=1`).bind(now).run();
    await env.DB.prepare(`UPDATE certificate_templates SET is_default=1, updated_at=? WHERE id=?`).bind(now, id).run();

    return json(200, "ok", { updated: true, default_id: id });
  }

  if(action === "deactivate"){
    const id = String(body.id || "").trim();
    if(!id) return json(400, "invalid_input", { message: "id" });
    await env.DB.prepare(`UPDATE certificate_templates SET status='inactive', is_default=0, updated_at=? WHERE id=?`).bind(now, id).run();
    return json(200, "ok", { updated: true });
  }

  if(action === "activate"){
    const id = String(body.id || "").trim();
    if(!id) return json(400, "invalid_input", { message: "id" });
    await env.DB.prepare(`UPDATE certificate_templates SET status='active', updated_at=? WHERE id=?`).bind(now, id).run();
    return json(200, "ok", { updated: true });
  }

  if(action === "duplicate"){
    const id = String(body.id || "").trim();
    if(!id) return json(400, "invalid_input", { message: "id" });

    const row = await env.DB.prepare(`SELECT * FROM certificate_templates WHERE id=? LIMIT 1`).bind(id).first();
    if(!row) return json(404, "not_found", { message: "template_not_found" });

    const newId = crypto.randomUUID();
    const newCode = String(body.new_code || (row.code + "_copy")).trim();
    const newName = String(body.new_name || (row.name + " Copy")).trim();

    await env.DB.prepare(`
      INSERT INTO certificate_templates (
        id, code, name, description, mode, html_template, css_template,
        background_url, page_width, is_default, status, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).bind(
      newId,
      newCode,
      newName,
      row.description,
      row.mode,
      row.html_template,
      row.css_template,
      row.background_url,
      row.page_width,
      row.status,
      a.uid,
      now,
      now
    ).run();

    return json(200, "ok", { duplicated: true, id: newId });
  }

  return json(400, "invalid_input", { message: "unknown_action" });
}

import { json, readJson, requireAuth, hasRole } from "../../_lib.js";

function canRead(a){
  return hasRole(a.roles, ["super_admin","admin","staff"]);
}

function replaceVars(txt, vars){
  let out = String(txt || "");
  for(const [k, v] of Object.entries(vars || {})){
    const re = new RegExp("\\{\\{" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\}\\}", "g");
    out = out.replace(re, String(v ?? ""));
  }
  return out;
}

function sampleVars(input){
  const now = new Date();
  return {
    name: input.name || "John Doe",
    role: input.role || "Lead Talent",
    project: input.project || "Spring Campaign 2026",
    organization: input.organization || "Orland Management",
    certificate_no: input.certificate_no || "OM-CERT-2026-000001",
    issue_date: input.issue_date || now.toISOString().slice(0,10),
    event_date_start: input.event_date_start || "2026-03-01",
    event_date_end: input.event_date_end || "2026-03-02",
    city: input.city || "Jakarta",
    description_formal: input.description_formal || "This certificate is awarded as formal recognition for professional participation and successful completion of duties in the assigned project under Orland Management.",
    signer_name: input.signer_name || "Orland Management",
    signer_title: input.signer_title || "Project Director",
    verification_url: input.verification_url || "https://example.com/certificate/verify?code=ABC12345"
  };
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const html_template = String(body.html_template || "").trim();
  const css_template = String(body.css_template || "").trim();
  const background_url = String(body.background_url || "").trim();
  const vars = sampleVars(body.vars || {});

  const html = replaceVars(html_template, vars);
  const css = replaceVars(css_template, vars);

  const doc = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
html,body{margin:0;padding:0;background:#f3f4f6}
.preview-wrap{padding:24px;display:flex;justify-content:center}
.preview-card{background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.08)}
${css}
${background_url ? `.cert-page{background-image:url('${background_url}');background-size:cover;background-position:center;background-repeat:no-repeat;}` : ""}
</style>
</head>
<body>
<div class="preview-wrap">
  <div class="preview-card">${html}</div>
</div>
</body>
</html>
  `.trim();

  return json(200, "ok", { html: doc, vars });
}

import { json, readJson, requireAuth, hasRole, nowSec, auditEvent } from "../../_lib.js";

function validSeverity(v){
  return ["low","medium","high","critical"].includes(String(v || "").toLowerCase());
}

export async function onRequestPost({ request, env }){
  const started = Date.now();

  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};

  const severity = String(body.severity || "medium").toLowerCase().trim();
  const type = String(body.type || "generic").trim();
  const summary = String(body.summary || "").trim();
  const details_json = body.details_json != null ? JSON.stringify(body.details_json) : null;
  const owner_user_id = body.owner_user_id ? String(body.owner_user_id).trim() : null;

  if(!validSeverity(severity)){
    return json(400, "invalid_input", { message:"invalid_severity" });
  }
  if(!type || !summary){
    return json(400, "invalid_input", { message:"type_summary_required" });
  }

  const now = nowSec();
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO incidents (
      id, severity, type, status, summary, details_json,
      created_at, updated_at, owner_user_id,
      acknowledged_by_user_id, closed_by_user_id
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    severity,
    type,
    "open",
    summary,
    details_json,
    now,
    now,
    owner_user_id,
    null,
    null
  ).run();

  await auditEvent(env, request, {
    actor_user_id: a.uid,
    action: "incidents_created",
    target_type: "incident",
    target_id: id,
    http_status: 200,
    duration_ms: Date.now() - started,
    meta: {
      severity,
      type,
      summary,
      owner_user_id
    }
  });

  return json(200, "ok", {
    created: true,
    incident: {
      id,
      severity,
      type,
      status: "open",
      summary,
      owner_user_id,
      created_at: now,
      updated_at: now
    }
  });
}

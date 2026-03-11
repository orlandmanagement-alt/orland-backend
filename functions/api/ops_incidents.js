import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

function s(v){ return String(v || "").trim(); }
function safeJson(v){
  try{ return JSON.parse(String(v || "{}")); }
  catch{ return {}; }
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const url = new URL(request.url);
  const status = s(url.searchParams.get("status"));
  const severity = s(url.searchParams.get("severity"));
  const q = s(url.searchParams.get("q")).toLowerCase();

  const r = await env.DB.prepare(`
    SELECT
      i.id,
      i.severity,
      i.type,
      i.status,
      i.summary,
      i.details_json,
      i.created_at,
      i.updated_at,
      i.owner_user_id,
      i.acknowledged_by_user_id,
      i.closed_by_user_id,
      u1.display_name AS owner_name,
      u2.display_name AS ack_name,
      u3.display_name AS closed_name
    FROM incidents i
    LEFT JOIN users u1 ON u1.id = i.owner_user_id
    LEFT JOIN users u2 ON u2.id = i.acknowledged_by_user_id
    LEFT JOIN users u3 ON u3.id = i.closed_by_user_id
    ORDER BY i.updated_at DESC, i.created_at DESC
  `).all();

  let items = (r.results || []).map(x => ({
    ...x,
    details_json: safeJson(x.details_json)
  }));

  if(status) items = items.filter(x => String(x.status || "") === status);
  if(severity) items = items.filter(x => String(x.severity || "") === severity);
  if(q){
    items = items.filter(x => {
      const hay = [
        x.id,
        x.summary,
        x.type,
        x.status,
        x.severity,
        x.owner_name
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  return json(200, "ok", {
    items,
    total: items.length
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const body = await readJson(request) || {};
  const action = s(body.action || "create").toLowerCase();

  if(action === "delete"){
    if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

    const id = s(body.id);
    if(!id) return json(400, "invalid_input", { message:"id_required" });

    const ex = await env.DB.prepare(`SELECT id FROM incidents WHERE id=? LIMIT 1`).bind(id).first();
    if(!ex) return json(404, "not_found", { message:"incident_not_found" });

    await env.DB.prepare(`DELETE FROM incident_comment_mentions WHERE incident_id=?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM incident_comments WHERE incident_id=?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM incidents WHERE id=?`).bind(id).run();

    return json(200, "ok", { deleted:true, id });
  }

  const mode = action === "update" ? "update" : "create";
  const id = s(body.id || (mode === "create" ? ("inc_" + crypto.randomUUID()) : ""));
  const severity = s(body.severity || "medium").toLowerCase();
  const type = s(body.type || "general");
  const status = s(body.status || "open").toLowerCase();
  const summary = s(body.summary);
  const details_json = body.details_json && typeof body.details_json === "object" ? body.details_json : {};
  const owner_user_id = s(body.owner_user_id || "");
  const now = nowSec();

  if(!id) return json(400, "invalid_input", { message:"id_required" });
  if(!summary) return json(400, "invalid_input", { message:"summary_required" });

  const allowedSeverity = ["low","medium","high","critical"];
  const allowedStatus = ["open","acknowledged","resolved","closed"];

  if(!allowedSeverity.includes(severity)){
    return json(400, "invalid_input", { message:"severity_invalid" });
  }
  if(!allowedStatus.includes(status)){
    return json(400, "invalid_input", { message:"status_invalid" });
  }

  if(mode === "create"){
    const ex = await env.DB.prepare(`SELECT id FROM incidents WHERE id=? LIMIT 1`).bind(id).first();
    if(ex) return json(400, "invalid_input", { message:"id_exists" });

    await env.DB.prepare(`
      INSERT INTO incidents (
        id, severity, type, status, summary, details_json, created_at, updated_at, owner_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      severity,
      type,
      status,
      summary,
      JSON.stringify(details_json),
      now,
      now,
      owner_user_id || null
    ).run();
  }else{
    const ex = await env.DB.prepare(`SELECT id FROM incidents WHERE id=? LIMIT 1`).bind(id).first();
    if(!ex) return json(404, "not_found", { message:"incident_not_found" });

    const ackBy = status === "acknowledged" ? a.user?.id || null : null;
    const closeBy = status === "closed" ? a.user?.id || null : null;

    await env.DB.prepare(`
      UPDATE incidents
      SET severity=?,
          type=?,
          status=?,
          summary=?,
          details_json=?,
          updated_at=?,
          owner_user_id=?,
          acknowledged_by_user_id=COALESCE(?, acknowledged_by_user_id),
          closed_by_user_id=COALESCE(?, closed_by_user_id)
      WHERE id=?
    `).bind(
      severity,
      type,
      status,
      summary,
      JSON.stringify(details_json),
      now,
      owner_user_id || null,
      ackBy,
      closeBy,
      id
    ).run();
  }

  return json(200, "ok", {
    saved: true,
    mode,
    id
  });
}

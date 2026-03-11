import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const id = String(body.id || "").trim();
  const action = String(body.action || "").trim().toLowerCase();
  const note = String(body.note || "").trim();

  if(!id){
    return json(400, "invalid_input", { message: "id_required" });
  }

  if(!["approve","reject"].includes(action)){
    return json(400, "invalid_input", { message: "invalid_action" });
  }

  const row = await env.DB.prepare(`
    SELECT id, user_id, kind, status, evidence_json
    FROM user_verifications
    WHERE id=?
    LIMIT 1
  `).bind(id).first();

  if(!row){
    return json(404, "not_found", { message: "verification_not_found" });
  }

  if(String(row.kind || "") !== "kyc"){
    return json(400, "invalid_input", { message: "only_kyc_supported" });
  }

  const now = nowSec();
  const nextStatus = action === "approve" ? "approved" : "rejected";

  await env.DB.prepare(`
    UPDATE user_verifications
    SET status=?,
        reviewed_by_user_id=?,
        reviewed_at=?,
        updated_at=?
    WHERE id=?
  `).bind(
    nextStatus,
    a.user.id,
    now,
    now,
    id
  ).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    a.user.id,
    action === "approve" ? "kyc_approved" : "kyc_rejected",
    "user_verification",
    id,
    JSON.stringify({
      user_id: row.user_id,
      status_from: String(row.status || ""),
      status_to: nextStatus,
      note
    }),
    now
  ).run();

  return json(200, "ok", {
    reviewed: true,
    id,
    status: nextStatus
  });
}

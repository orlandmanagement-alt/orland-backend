import { json, readJson } from "../../../_lib.js";
import { requireRevisionAccess, rollbackRevision } from "./revision_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireRevisionAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const revision_id = String(body.revision_id || "").trim();
  const note = String(body.note || "").trim();

  if(!revision_id){
    return json(400, "invalid_input", { error:"revision_id_required" });
  }

  const revisionRow = await env.DB.prepare(`
    SELECT
      id, item_kind, item_id, revision_no, source_action,
      actor_user_id, title, slug, status, snapshot_json, note, created_at
    FROM blogspot_revision_history
    WHERE id=?
    LIMIT 1
  `).bind(revision_id).first();

  if(!revisionRow){
    return json(404, "not_found", { error:"revision_not_found" });
  }

  const result = await rollbackRevision(env, a.uid || null, revisionRow, note);
  if(!result.ok){
    return json(400, "invalid_input", { error: result.error || "rollback_failed" });
  }

  return json(200, "ok", {
    rolled_back: true,
    item_kind: result.item_kind,
    item_id: result.item_id,
    applied_revision_no: result.applied_revision_no,
    source_revision_id: revisionRow.id,
    source_revision_no: Number(revisionRow.revision_no || 0)
  });
}

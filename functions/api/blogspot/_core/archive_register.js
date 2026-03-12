import { json, readJson } from "../../../_lib.js";
import {
  requireArchiveAccess,
  nowSec,
  periodKeyFromRange,
  archiveNo,
  nextArchiveSeq,
  addArchiveLog
} from "./archive_registry_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireArchiveAccess(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};

  const archive_name = String(body.archive_name || "blogspot_evidence_bundle").trim();
  const archive_version = String(body.archive_version || "v1").trim();
  const range_from = Number(body.range_from || 0);
  const range_to = Number(body.range_to || 0);
  const note = String(body.note || "").trim();

  const checksums = body.checksums && typeof body.checksums === "object"
    ? body.checksums
    : {};

  const summary = body.summary && typeof body.summary === "object"
    ? body.summary
    : {};

  const signature = body.signature && typeof body.signature === "object"
    ? body.signature
    : {};

  if(!checksums.snapshot || !checksums.logs || !checksums.approvals || !checksums.delete_requests || !checksums.risk_register){
    return json(400, "invalid_input", { error:"checksums_incomplete" });
  }

  const period_key = String(body.period_key || periodKeyFromRange(range_from, range_to)).trim();
  const seq = await nextArchiveSeq(env, period_key);
  const archive_no_value = archiveNo(period_key, seq);
  const id = crypto.randomUUID();
  const registered_at = nowSec();

  await env.DB.prepare(`
    INSERT INTO blogspot_archive_registry (
      id, archive_no, archive_name, archive_version, period_key,
      range_from, range_to,
      snapshot_hash, logs_hash, approvals_hash, delete_requests_hash, risk_register_hash,
      bundle_signature_mode, bundle_signature_algorithm, bundle_signature_value,
      item_logs_count, item_approvals_count, item_delete_requests_count, item_risk_count,
      registered_by, registered_at, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    archive_no_value,
    archive_name,
    archive_version,
    period_key,
    Number.isFinite(range_from) ? range_from : 0,
    Number.isFinite(range_to) ? range_to : 0,
    String(checksums.snapshot || ""),
    String(checksums.logs || ""),
    String(checksums.approvals || ""),
    String(checksums.delete_requests || ""),
    String(checksums.risk_register || ""),
    String(signature.mode || ""),
    String(signature.algorithm || ""),
    String(signature.value || ""),
    Number(summary.logs_count || 0),
    Number(summary.approvals_count || 0),
    Number(summary.delete_requests_count || 0),
    Number(summary.risk_register_count || 0),
    a.uid || null,
    registered_at,
    note || null
  ).run();

  await addArchiveLog(env, {
    direction: "system",
    kind: "system",
    action: "archive_register",
    status: "ok",
    message: "evidence archive registered",
    payload_json: {
      archive_id: id,
      archive_no: archive_no_value,
      period_key
    }
  });

  return json(200, "ok", {
    registered: true,
    id,
    archive_no: archive_no_value,
    period_key
  });
}

import { json, readJson } from "../../../_lib.js";
import {
  requireArchiveAccess,
  nowSec,
  sealNo,
  stableJson,
  sha256Hex,
  hmacSha256Hex,
  addArchiveLog
} from "./archive_registry_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireArchiveAccess(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const period_key = String(body.period_key || "").trim();
  const note = String(body.note || "").trim();

  if(!period_key){
    return json(400, "invalid_input", { error:"period_key_required" });
  }

  const exists = await env.DB.prepare(`
    SELECT id
    FROM blogspot_archive_monthly_seals
    WHERE period_key=?
    LIMIT 1
  `).bind(period_key).first();

  if(exists){
    return json(400, "invalid_input", { error:"monthly_seal_already_exists" });
  }

  const rows = await env.DB.prepare(`
    SELECT
      archive_no, archive_name, archive_version, period_key,
      range_from, range_to,
      snapshot_hash, logs_hash, approvals_hash, delete_requests_hash, risk_register_hash,
      bundle_signature_mode, bundle_signature_algorithm, bundle_signature_value,
      item_logs_count, item_approvals_count, item_delete_requests_count, item_risk_count,
      registered_at
    FROM blogspot_archive_registry
    WHERE period_key=?
    ORDER BY registered_at ASC, archive_no ASC
  `).bind(period_key).all();

  const items = (rows.results || []).map(x => ({
    archive_no: String(x.archive_no || ""),
    archive_name: String(x.archive_name || ""),
    archive_version: String(x.archive_version || ""),
    period_key: String(x.period_key || ""),
    range_from: Number(x.range_from || 0),
    range_to: Number(x.range_to || 0),
    snapshot_hash: String(x.snapshot_hash || ""),
    logs_hash: String(x.logs_hash || ""),
    approvals_hash: String(x.approvals_hash || ""),
    delete_requests_hash: String(x.delete_requests_hash || ""),
    risk_register_hash: String(x.risk_register_hash || ""),
    bundle_signature_mode: String(x.bundle_signature_mode || ""),
    bundle_signature_algorithm: String(x.bundle_signature_algorithm || ""),
    bundle_signature_value: String(x.bundle_signature_value || ""),
    item_logs_count: Number(x.item_logs_count || 0),
    item_approvals_count: Number(x.item_approvals_count || 0),
    item_delete_requests_count: Number(x.item_delete_requests_count || 0),
    item_risk_count: Number(x.item_risk_count || 0),
    registered_at: Number(x.registered_at || 0)
  }));

  if(!items.length){
    return json(400, "invalid_input", { error:"no_archive_in_period" });
  }

  const registry_digest = await sha256Hex(stableJson(items));
  const secret = String(env.BLOGSPOT_EVIDENCE_SIGNING_SECRET || "").trim();

  let seal_signature_mode = "unsigned";
  let seal_signature_algorithm = null;
  let seal_signature_value = null;

  if(secret){
    seal_signature_mode = "hmac";
    seal_signature_algorithm = "HMAC-SHA256";
    seal_signature_value = await hmacSha256Hex(secret, stableJson({
      period_key,
      archive_count: items.length,
      registry_digest
    }));
  }

  const id = crypto.randomUUID();
  const seal_no_value = sealNo(period_key);
  const sealed_at = nowSec();

  await env.DB.prepare(`
    INSERT INTO blogspot_archive_monthly_seals (
      id, seal_no, period_key, archive_count, registry_digest,
      seal_signature_mode, seal_signature_algorithm, seal_signature_value,
      sealed_by, sealed_at, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    seal_no_value,
    period_key,
    items.length,
    registry_digest,
    seal_signature_mode,
    seal_signature_algorithm,
    seal_signature_value,
    a.uid || null,
    sealed_at,
    note || null
  ).run();

  await addArchiveLog(env, {
    direction: "system",
    kind: "system",
    action: "archive_monthly_seal_create",
    status: "ok",
    message: "archive monthly seal created",
    payload_json: {
      seal_id: id,
      seal_no: seal_no_value,
      period_key,
      archive_count: items.length
    }
  });

  return json(200, "ok", {
    sealed: true,
    id,
    seal_no: seal_no_value,
    period_key,
    archive_count: items.length,
    registry_digest,
    signature: {
      mode: seal_signature_mode,
      algorithm: seal_signature_algorithm,
      value: seal_signature_value
    }
  });
}

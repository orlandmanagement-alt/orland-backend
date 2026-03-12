import { json } from "../../../_lib.js";
import { requireArchiveAccess } from "./archive_registry_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireArchiveAccess(env, request);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const period_key = String(url.searchParams.get("period_key") || "").trim();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "50")));

  let sql = `
    SELECT
      id, archive_no, archive_name, archive_version, period_key,
      range_from, range_to,
      snapshot_hash, logs_hash, approvals_hash, delete_requests_hash, risk_register_hash,
      bundle_signature_mode, bundle_signature_algorithm, bundle_signature_value,
      item_logs_count, item_approvals_count, item_delete_requests_count, item_risk_count,
      registered_by, registered_at, note
    FROM blogspot_archive_registry
    WHERE 1=1
  `;
  const binds = [];

  if(period_key){
    sql += ` AND period_key=?`;
    binds.push(period_key);
  }

  sql += ` ORDER BY registered_at DESC LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      id: String(x.id || ""),
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
      registered_by: x.registered_by || null,
      registered_at: Number(x.registered_at || 0),
      note: String(x.note || "")
    }))
  });
}

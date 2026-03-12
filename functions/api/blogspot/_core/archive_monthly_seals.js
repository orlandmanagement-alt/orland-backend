import { json } from "../../../_lib.js";
import { requireArchiveAccess } from "./archive_registry_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireArchiveAccess(env, request);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const period_key = String(url.searchParams.get("period_key") || "").trim();
  const limit = Math.max(1, Math.min(120, Number(url.searchParams.get("limit") || "24")));

  let sql = `
    SELECT
      id, seal_no, period_key, archive_count, registry_digest,
      seal_signature_mode, seal_signature_algorithm, seal_signature_value,
      sealed_by, sealed_at, note
    FROM blogspot_archive_monthly_seals
    WHERE 1=1
  `;
  const binds = [];

  if(period_key){
    sql += ` AND period_key=?`;
    binds.push(period_key);
  }

  sql += ` ORDER BY sealed_at DESC LIMIT ?`;
  binds.push(limit);

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      id: String(x.id || ""),
      seal_no: String(x.seal_no || ""),
      period_key: String(x.period_key || ""),
      archive_count: Number(x.archive_count || 0),
      registry_digest: String(x.registry_digest || ""),
      seal_signature_mode: String(x.seal_signature_mode || ""),
      seal_signature_algorithm: String(x.seal_signature_algorithm || ""),
      seal_signature_value: String(x.seal_signature_value || ""),
      sealed_by: x.sealed_by || null,
      sealed_at: Number(x.sealed_at || 0),
      note: String(x.note || "")
    }))
  });
}

import { requireEvidenceAccess, parseRange, whereCreatedAt, toCsv, asCsv } from "./evidence_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireEvidenceAccess(env, request);
  if(!a.ok) return a.res;

  const range = parseRange(request);
  const wh = whereCreatedAt(range, "created_at");

  const r = await env.DB.prepare(`
    SELECT
      id, direction, kind, local_id, remote_id,
      action, status, message, payload_json, created_at
    FROM blogspot_sync_logs
    ${wh.sql}
    ORDER BY created_at DESC
    LIMIT 5000
  `).bind(...wh.binds).all();

  const rows = (r.results || []).map(x => ({
    id: String(x.id || ""),
    direction: String(x.direction || ""),
    kind: String(x.kind || ""),
    local_id: String(x.local_id || ""),
    remote_id: String(x.remote_id || ""),
    action: String(x.action || ""),
    status: String(x.status || ""),
    message: String(x.message || ""),
    payload_json: String(x.payload_json || ""),
    created_at: Number(x.created_at || 0)
  }));

  return asCsv(
    toCsv(
      ["id","direction","kind","local_id","remote_id","action","status","message","payload_json","created_at"],
      rows
    ),
    "blogspot_evidence_logs.csv"
  );
}

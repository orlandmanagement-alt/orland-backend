import { requireEvidenceAccess, parseRange, whereCreatedAt, toCsv, asCsv } from "./evidence_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireEvidenceAccess(env, request);
  if(!a.ok) return a.res;

  const range = parseRange(request);
  const wh = whereCreatedAt(range, "requested_at");

  const r = await env.DB.prepare(`
    SELECT
      id, kind, local_id, remote_id, title, slug, reason,
      requested_by, requested_at, status,
      decided_by, decided_at, decision_note,
      executed_by, executed_at, result_status, result_message
    FROM blogspot_remote_delete_requests
    ${wh.sql}
    ORDER BY requested_at DESC
    LIMIT 5000
  `).bind(...wh.binds).all();

  const rows = (r.results || []).map(x => ({
    id: String(x.id || ""),
    kind: String(x.kind || ""),
    local_id: String(x.local_id || ""),
    remote_id: String(x.remote_id || ""),
    title: String(x.title || ""),
    slug: String(x.slug || ""),
    reason: String(x.reason || ""),
    requested_by: String(x.requested_by || ""),
    requested_at: Number(x.requested_at || 0),
    status: String(x.status || ""),
    decided_by: String(x.decided_by || ""),
    decided_at: Number(x.decided_at || 0),
    decision_note: String(x.decision_note || ""),
    executed_by: String(x.executed_by || ""),
    executed_at: Number(x.executed_at || 0),
    result_status: String(x.result_status || ""),
    result_message: String(x.result_message || "")
  }));

  return asCsv(
    toCsv(
      ["id","kind","local_id","remote_id","title","slug","reason","requested_by","requested_at","status","decided_by","decided_at","decision_note","executed_by","executed_at","result_status","result_message"],
      rows
    ),
    "blogspot_evidence_delete_requests.csv"
  );
}

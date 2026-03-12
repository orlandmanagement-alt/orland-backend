import { requireEvidenceAccess, toCsv, asCsv } from "./evidence_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireEvidenceAccess(env, request);
  if(!a.ok) return a.res;

  const r = await env.DB.prepare(`
    SELECT
      local_id, remote_id, kind, title, slug,
      approval_status, approved_by, approved_at,
      sync_state, sync_error, dirty, deleted_remote,
      last_synced_at, last_pushed_at
    FROM blogspot_post_map
    ORDER BY
      CASE
        WHEN approval_status='pending' THEN 1
        WHEN approval_status='approved' THEN 2
        WHEN approval_status='rejected' THEN 3
        ELSE 9
      END ASC,
      COALESCE(last_pushed_at, last_synced_at, approved_at, 0) DESC
    LIMIT 5000
  `).all();

  const rows = (r.results || []).map(x => ({
    local_id: String(x.local_id || ""),
    remote_id: String(x.remote_id || ""),
    kind: String(x.kind || ""),
    title: String(x.title || ""),
    slug: String(x.slug || ""),
    approval_status: String(x.approval_status || ""),
    approved_by: String(x.approved_by || ""),
    approved_at: Number(x.approved_at || 0),
    sync_state: String(x.sync_state || ""),
    sync_error: String(x.sync_error || ""),
    dirty: Number(x.dirty || 0),
    deleted_remote: Number(x.deleted_remote || 0),
    last_synced_at: Number(x.last_synced_at || 0),
    last_pushed_at: Number(x.last_pushed_at || 0)
  }));

  return asCsv(
    toCsv(
      ["local_id","remote_id","kind","title","slug","approval_status","approved_by","approved_at","sync_state","sync_error","dirty","deleted_remote","last_synced_at","last_pushed_at"],
      rows
    ),
    "blogspot_evidence_approvals.csv"
  );
}

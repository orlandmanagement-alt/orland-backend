import { requireEvidenceAccess, toCsv, asCsv } from "./evidence_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireEvidenceAccess(env, request);
  if(!a.ok) return a.res;

  const r = await env.DB.prepare(`
    SELECT
      local_id, remote_id, kind, title, slug,
      approval_status, sync_state, sync_error,
      dirty, deleted_remote, last_synced_at, last_pushed_at
    FROM blogspot_post_map
    WHERE
      deleted_remote=1
      OR dirty=1
      OR sync_state IN ('drift_detected','conflict_possible','error','approval_pending')
    ORDER BY
      CASE
        WHEN deleted_remote=1 THEN 1
        WHEN sync_state='error' THEN 2
        WHEN sync_state='conflict_possible' THEN 3
        WHEN sync_state='drift_detected' THEN 4
        WHEN sync_state='approval_pending' THEN 5
        WHEN dirty=1 THEN 6
        ELSE 9
      END ASC,
      COALESCE(last_pushed_at, last_synced_at, 0) DESC
    LIMIT 5000
  `).all();

  const rows = (r.results || []).map(x => ({
    local_id: String(x.local_id || ""),
    remote_id: String(x.remote_id || ""),
    kind: String(x.kind || ""),
    title: String(x.title || ""),
    slug: String(x.slug || ""),
    approval_status: String(x.approval_status || ""),
    sync_state: String(x.sync_state || ""),
    sync_error: String(x.sync_error || ""),
    dirty: Number(x.dirty || 0),
    deleted_remote: Number(x.deleted_remote || 0),
    last_synced_at: Number(x.last_synced_at || 0),
    last_pushed_at: Number(x.last_pushed_at || 0)
  }));

  return asCsv(
    toCsv(
      ["local_id","remote_id","kind","title","slug","approval_status","sync_state","sync_error","dirty","deleted_remote","last_synced_at","last_pushed_at"],
      rows
    ),
    "blogspot_evidence_risk_register.csv"
  );
}

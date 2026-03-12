import { countOne, parseRange, requireEvidenceAccess, whereCreatedAt, asJson } from "./evidence_shared.js";

async function getState(env, k){
  const row = await env.DB.prepare(`
    SELECT v FROM blogspot_sync_state WHERE k=? LIMIT 1
  `).bind(k).first();
  return row ? String(row.v || "") : "";
}

async function getConfig(env, k){
  const row = await env.DB.prepare(`
    SELECT v FROM blogspot_sync_config WHERE k=? LIMIT 1
  `).bind(k).first();
  return row ? String(row.v || "") : "";
}

export async function onRequestGet({ request, env }){
  const a = await requireEvidenceAccess(env, request);
  if(!a.ok) return a.res;

  const range = parseRange(request);
  const logsWhere = whereCreatedAt(range, "created_at");
  const delWhere = whereCreatedAt(range, "requested_at");

  const [
    local_posts,
    local_pages,
    active_widgets,
    dirty_total,
    approval_pending_total,
    approval_approved_total,
    approval_rejected_total,
    remote_deleted_total,
    drift_total,
    conflict_total,
    error_total,
    logs_total,
    delete_pending_total,
    delete_approved_total,
    delete_executed_total,
    delete_rejected_total,
    last_run_at,
    last_success_at,
    last_status,
    last_message,
    write_lock_enabled,
    maintenance_mode,
    remote_delete_requires_approval
  ] = await Promise.all([
    countOne(env, `SELECT COUNT(*) AS total FROM cms_posts WHERE provider='blogspot'`),
    countOne(env, `SELECT COUNT(*) AS total FROM cms_pages WHERE provider='blogspot'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_widget_home WHERE status='active'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE dirty=1`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE approval_status='pending'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE approval_status='approved'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE approval_status='rejected'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE deleted_remote=1`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE sync_state='drift_detected'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE sync_state='conflict_possible'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_post_map WHERE sync_state='error'`),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_sync_logs${logsWhere.sql}`, ...logsWhere.binds),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_remote_delete_requests${delWhere.sql}${delWhere.sql ? " AND" : " WHERE"} status='pending'`, ...delWhere.binds),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_remote_delete_requests${delWhere.sql}${delWhere.sql ? " AND" : " WHERE"} status='approved'`, ...delWhere.binds),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_remote_delete_requests${delWhere.sql}${delWhere.sql ? " AND" : " WHERE"} status='executed'`, ...delWhere.binds),
    countOne(env, `SELECT COUNT(*) AS total FROM blogspot_remote_delete_requests${delWhere.sql}${delWhere.sql ? " AND" : " WHERE"} status='rejected'`, ...delWhere.binds),
    getState(env, "last_run_at"),
    getState(env, "last_success_at"),
    getState(env, "last_status"),
    getState(env, "last_message"),
    getConfig(env, "write_lock_enabled"),
    getConfig(env, "maintenance_mode"),
    getConfig(env, "remote_delete_requires_approval")
  ]);

  return asJson({
    generated_at: Math.floor(Date.now() / 1000),
    range,
    kpi: {
      local_posts,
      local_pages,
      active_widgets,
      dirty_total,
      approval_pending_total,
      approval_approved_total,
      approval_rejected_total,
      remote_deleted_total,
      drift_total,
      conflict_total,
      error_total,
      logs_total,
      delete_pending_total,
      delete_approved_total,
      delete_executed_total,
      delete_rejected_total
    },
    sync: {
      last_run_at: Number(last_run_at || 0),
      last_success_at: Number(last_success_at || 0),
      last_status: last_status || "idle",
      last_message: last_message || ""
    },
    safety: {
      write_lock_enabled: write_lock_enabled === "1",
      maintenance_mode: maintenance_mode === "1",
      remote_delete_requires_approval: remote_delete_requires_approval !== "0"
    }
  }, "blogspot_evidence_snapshot.json");
}

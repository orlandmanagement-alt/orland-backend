import { requireBlogspotAccess } from "./_service.js";

export async function requireEvidenceBundleAccess(env, request){
  return await requireBlogspotAccess(env, request, true);
}

export function parseRange(request){
  const url = new URL(request.url);
  const from = Number(url.searchParams.get("from") || "0");
  const to = Number(url.searchParams.get("to") || "0");
  return {
    from: Number.isFinite(from) && from > 0 ? from : 0,
    to: Number.isFinite(to) && to > 0 ? to : 0
  };
}

export function whereByTs(range, column = "created_at"){
  const wh = [];
  const binds = [];
  if(range.from > 0){
    wh.push(`${column} >= ?`);
    binds.push(range.from);
  }
  if(range.to > 0){
    wh.push(`${column} <= ?`);
    binds.push(range.to);
  }
  return {
    sql: wh.length ? ` WHERE ${wh.join(" AND ")}` : "",
    binds
  };
}

export function base64FromBytes(bytes){
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for(const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

export function hexFromBytes(bytes){
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr).map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input){
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(input ?? ""))
  );
  return hexFromBytes(new Uint8Array(buf));
}

export async function hmacSha256Hex(secret, payload){
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(payload ?? ""))
  );

  return hexFromBytes(new Uint8Array(sig));
}

export function stableJson(v){
  return JSON.stringify(sortDeep(v));
}

function sortDeep(v){
  if(Array.isArray(v)){
    return v.map(sortDeep);
  }
  if(v && typeof v === "object"){
    const out = {};
    for(const k of Object.keys(v).sort()){
      out[k] = sortDeep(v[k]);
    }
    return out;
  }
  return v;
}

export async function countOne(env, sql, ...binds){
  const row = await env.DB.prepare(sql).bind(...binds).first();
  return Number(row?.total || 0);
}

export async function getState(env, k){
  const row = await env.DB.prepare(`
    SELECT v
    FROM blogspot_sync_state
    WHERE k=?
    LIMIT 1
  `).bind(k).first();
  return row ? String(row.v || "") : "";
}

export async function getConfig(env, k){
  const row = await env.DB.prepare(`
    SELECT v
    FROM blogspot_sync_config
    WHERE k=?
    LIMIT 1
  `).bind(k).first();
  return row ? String(row.v || "") : "";
}

export async function buildSnapshotSection(env, range){
  const logsWhere = whereByTs(range, "created_at");
  const delWhere = whereByTs(range, "requested_at");

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

  return {
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
  };
}

export async function buildLogsSection(env, range){
  const wh = whereByTs(range, "created_at");
  const r = await env.DB.prepare(`
    SELECT
      id, direction, kind, local_id, remote_id,
      action, status, message, payload_json, created_at
    FROM blogspot_sync_logs
    ${wh.sql}
    ORDER BY created_at DESC
    LIMIT 5000
  `).bind(...wh.binds).all();

  return (r.results || []).map(x => ({
    id: String(x.id || ""),
    direction: String(x.direction || ""),
    kind: String(x.kind || ""),
    local_id: String(x.local_id || ""),
    remote_id: String(x.remote_id || ""),
    action: String(x.action || ""),
    status: String(x.status || ""),
    message: String(x.message || ""),
    created_at: Number(x.created_at || 0),
    payload_json: (() => {
      try{ return JSON.parse(String(x.payload_json || "{}")); }
      catch{ return {}; }
    })()
  }));
}

export async function buildApprovalsSection(env){
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

  return (r.results || []).map(x => ({
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
}

export async function buildDeleteRequestsSection(env, range){
  const wh = whereByTs(range, "requested_at");
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

  return (r.results || []).map(x => ({
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
}

export async function buildRiskRegisterSection(env){
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

  return (r.results || []).map(x => ({
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
}

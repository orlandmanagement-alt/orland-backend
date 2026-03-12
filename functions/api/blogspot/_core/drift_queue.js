import { json } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const item_kind = String(url.searchParams.get("item_kind") || "").trim().toLowerCase();
  const sync_state = String(url.searchParams.get("sync_state") || "").trim().toLowerCase();
  const approval_status = String(url.searchParams.get("approval_status") || "").trim().toLowerCase();
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || "100")));

  const r = await env.DB.prepare(`
    WITH union_items AS (
      SELECT
        'post' AS item_kind,
        p.id AS item_id,
        p.title AS title,
        p.slug AS slug,
        p.status AS item_status,
        p.url AS url,
        p.updated_at AS item_updated_at,
        m.remote_id AS remote_id,
        m.remote_updated AS remote_updated,
        m.last_synced_at AS last_synced_at,
        m.last_pushed_at AS last_pushed_at,
        m.dirty AS dirty,
        m.deleted_local AS deleted_local,
        m.deleted_remote AS deleted_remote,
        m.approval_status AS approval_status,
        m.sync_state AS sync_state,
        m.sync_error AS sync_error
      FROM blogspot_post_map m
      LEFT JOIN cms_posts p
        ON p.id = m.local_id
      WHERE m.kind = 'post'

      UNION ALL

      SELECT
        'page' AS item_kind,
        p.id AS item_id,
        p.title AS title,
        p.slug AS slug,
        p.status AS item_status,
        p.url AS url,
        p.updated_at AS item_updated_at,
        m.remote_id AS remote_id,
        m.remote_updated AS remote_updated,
        m.last_synced_at AS last_synced_at,
        m.last_pushed_at AS last_pushed_at,
        m.dirty AS dirty,
        m.deleted_local AS deleted_local,
        m.deleted_remote AS deleted_remote,
        m.approval_status AS approval_status,
        m.sync_state AS sync_state,
        m.sync_error AS sync_error
      FROM blogspot_post_map m
      LEFT JOIN cms_pages p
        ON p.id = m.local_id
      WHERE m.kind = 'page'
    )
    SELECT *
    FROM union_items
    WHERE
      (
        deleted_remote = 1
        OR dirty = 1
        OR sync_state IN ('conflict_possible', 'conflict_remote_missing', 'drift_detected', 'error', 'approval_pending')
      )
      AND (? = '' OR item_kind = ?)
      AND (? = '' OR lower(sync_state) = ?)
      AND (? = '' OR lower(approval_status) = ?)
      AND (
        ? = ''
        OR lower(coalesce(item_id, '')) LIKE ?
        OR lower(coalesce(title, '')) LIKE ?
        OR lower(coalesce(slug, '')) LIKE ?
        OR lower(coalesce(remote_id, '')) LIKE ?
      )
    ORDER BY
      CASE
        WHEN deleted_remote = 1 THEN 1
        WHEN lower(sync_state) = 'error' THEN 2
        WHEN lower(sync_state) = 'conflict_remote_missing' THEN 3
        WHEN lower(sync_state) = 'conflict_possible' THEN 4
        WHEN lower(sync_state) = 'drift_detected' THEN 5
        WHEN lower(sync_state) = 'approval_pending' THEN 6
        WHEN dirty = 1 THEN 7
        ELSE 99
      END ASC,
      coalesce(item_updated_at, 0) DESC,
      coalesce(last_synced_at, 0) DESC
    LIMIT ?
  `).bind(
    item_kind, item_kind,
    sync_state, sync_state,
    approval_status, approval_status,
    q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`,
    limit
  ).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      item_kind: String(x.item_kind || ""),
      item_id: String(x.item_id || ""),
      title: String(x.title || ""),
      slug: String(x.slug || ""),
      item_status: String(x.item_status || ""),
      url: String(x.url || ""),
      item_updated_at: Number(x.item_updated_at || 0),
      remote_id: String(x.remote_id || ""),
      remote_updated: String(x.remote_updated || ""),
      last_synced_at: Number(x.last_synced_at || 0),
      last_pushed_at: Number(x.last_pushed_at || 0),
      dirty: Number(x.dirty || 0),
      deleted_local: Number(x.deleted_local || 0),
      deleted_remote: Number(x.deleted_remote || 0),
      approval_status: String(x.approval_status || ""),
      sync_state: String(x.sync_state || ""),
      sync_error: String(x.sync_error || "")
    })),
    total: (r.results || []).length
  });
}

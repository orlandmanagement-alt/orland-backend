import { nowSec } from "../../../_lib.js";
import { requireBlogspotAccess, markMapDirty, makeId } from "./_service.js";

export async function requireRevisionAccess(env, request, allowStaff = true){
  return await requireBlogspotAccess(env, request, allowStaff);
}

export function safeJsonParse(v, fallback = null){
  try{
    const x = JSON.parse(String(v || ""));
    return x ?? fallback;
  }catch{
    return fallback;
  }
}

export async function nextRevisionNo(env, itemKind, itemId){
  const row = await env.DB.prepare(`
    SELECT COALESCE(MAX(revision_no), 0) AS max_rev
    FROM blogspot_revision_history
    WHERE item_kind=? AND item_id=?
  `).bind(String(itemKind), String(itemId)).first();

  return Number(row?.max_rev || 0) + 1;
}

export async function addSyncAuditLog(env, row){
  try{
    await env.DB.prepare(`
      INSERT INTO blogspot_sync_logs (
        id, direction, kind, local_id, remote_id, action, status, message, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId("bslog"),
      String(row.direction || "system"),
      String(row.kind || "system"),
      row.local_id || null,
      row.remote_id || null,
      String(row.action || "revision"),
      String(row.status || "ok"),
      String(row.message || ""),
      JSON.stringify(row.payload_json || {}),
      nowSec()
    ).run();
  }catch{}
}

export async function loadPostRow(env, id){
  return await env.DB.prepare(`
    SELECT
      id, provider, account_id, external_id, blog_id, title, slug, status, url,
      content_html, content_text, labels_json, meta_json, published_at, updated_at, created_at
    FROM cms_posts
    WHERE id=?
    LIMIT 1
  `).bind(String(id)).first();
}

export async function loadPageRow(env, id){
  return await env.DB.prepare(`
    SELECT
      id, provider, account_id, external_id, blog_id, title, slug, status, url,
      content_html, meta_json, published_at, updated_at, created_at
    FROM cms_pages
    WHERE id=?
    LIMIT 1
  `).bind(String(id)).first();
}

export function buildPostSnapshot(row, extra = {}){
  return {
    item_kind: "post",
    id: String(row?.id || ""),
    provider: String(row?.provider || "blogspot"),
    account_id: String(row?.account_id || ""),
    external_id: String(row?.external_id || ""),
    blog_id: row?.blog_id || null,
    title: String(row?.title || ""),
    slug: String(row?.slug || ""),
    status: String(row?.status || "draft"),
    url: row?.url || null,
    content_html: String(row?.content_html || ""),
    content_text: row?.content_text || null,
    labels_json: safeJsonParse(row?.labels_json, []),
    meta_json: safeJsonParse(row?.meta_json, {}),
    published_at: row?.published_at != null ? Number(row.published_at || 0) : null,
    updated_at: row?.updated_at != null ? Number(row.updated_at || 0) : null,
    created_at: Number(row?.created_at || 0),
    ...extra
  };
}

export function buildPageSnapshot(row, extra = {}){
  return {
    item_kind: "page",
    id: String(row?.id || ""),
    provider: String(row?.provider || "blogspot"),
    account_id: String(row?.account_id || ""),
    external_id: String(row?.external_id || ""),
    blog_id: row?.blog_id || null,
    title: String(row?.title || ""),
    slug: String(row?.slug || ""),
    status: String(row?.status || "draft"),
    url: row?.url || null,
    content_html: String(row?.content_html || ""),
    meta_json: safeJsonParse(row?.meta_json, {}),
    published_at: row?.published_at != null ? Number(row.published_at || 0) : null,
    updated_at: row?.updated_at != null ? Number(row.updated_at || 0) : null,
    created_at: Number(row?.created_at || 0),
    ...extra
  };
}

export async function createRevision(env, {
  item_kind,
  item_id,
  source_action,
  actor_user_id = null,
  title = "",
  slug = "",
  status = "",
  snapshot = {},
  note = ""
}){
  const revision_no = await nextRevisionNo(env, item_kind, item_id);
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO blogspot_revision_history (
      id, item_kind, item_id, revision_no, source_action, actor_user_id,
      title, slug, status, snapshot_json, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    String(item_kind),
    String(item_id),
    revision_no,
    String(source_action || "update"),
    actor_user_id,
    String(title || ""),
    String(slug || ""),
    String(status || ""),
    JSON.stringify(snapshot || {}),
    String(note || ""),
    nowSec()
  ).run();

  return { id, revision_no };
}

export async function capturePostRevision(env, actor_user_id, id, source_action = "update", note = ""){
  const row = await loadPostRow(env, id);
  if(!row) return null;

  const snapshot = buildPostSnapshot(row, { revision_reason: note || "" });
  return await createRevision(env, {
    item_kind: "post",
    item_id: row.id,
    source_action,
    actor_user_id,
    title: row.title || "",
    slug: row.slug || "",
    status: row.status || "",
    snapshot,
    note
  });
}

export async function capturePageRevision(env, actor_user_id, id, source_action = "update", note = ""){
  const row = await loadPageRow(env, id);
  if(!row) return null;

  const snapshot = buildPageSnapshot(row, { revision_reason: note || "" });
  return await createRevision(env, {
    item_kind: "page",
    item_id: row.id,
    source_action,
    actor_user_id,
    title: row.title || "",
    slug: row.slug || "",
    status: row.status || "",
    snapshot,
    note
  });
}

export async function applyPostSnapshot(env, snapshot){
  await env.DB.prepare(`
    UPDATE cms_posts
    SET provider=?,
        account_id=?,
        external_id=?,
        blog_id=?,
        title=?,
        slug=?,
        status=?,
        url=?,
        content_html=?,
        content_text=?,
        labels_json=?,
        meta_json=?,
        published_at=?,
        updated_at=?
    WHERE id=?
  `).bind(
    String(snapshot.provider || "blogspot"),
    String(snapshot.account_id || ""),
    String(snapshot.external_id || ""),
    snapshot.blog_id || null,
    String(snapshot.title || ""),
    snapshot.slug || null,
    String(snapshot.status || "draft"),
    snapshot.url || null,
    String(snapshot.content_html || ""),
    snapshot.content_text || null,
    JSON.stringify(Array.isArray(snapshot.labels_json) ? snapshot.labels_json : []),
    JSON.stringify(snapshot.meta_json && typeof snapshot.meta_json === "object" ? snapshot.meta_json : {}),
    snapshot.published_at != null ? Number(snapshot.published_at || 0) : null,
    nowSec(),
    String(snapshot.id || "")
  ).run();
}

export async function applyPageSnapshot(env, snapshot){
  await env.DB.prepare(`
    UPDATE cms_pages
    SET provider=?,
        account_id=?,
        external_id=?,
        blog_id=?,
        title=?,
        slug=?,
        status=?,
        url=?,
        content_html=?,
        meta_json=?,
        published_at=?,
        updated_at=?
    WHERE id=?
  `).bind(
    String(snapshot.provider || "blogspot"),
    String(snapshot.account_id || ""),
    String(snapshot.external_id || ""),
    snapshot.blog_id || null,
    String(snapshot.title || ""),
    snapshot.slug || null,
    String(snapshot.status || "draft"),
    snapshot.url || null,
    String(snapshot.content_html || ""),
    JSON.stringify(snapshot.meta_json && typeof snapshot.meta_json === "object" ? snapshot.meta_json : {}),
    snapshot.published_at != null ? Number(snapshot.published_at || 0) : null,
    nowSec(),
    String(snapshot.id || "")
  ).run();
}

export async function markDirtyAfterRollback(env, itemKind, snapshot){
  await markMapDirty(env, itemKind, String(snapshot.id || ""), {
    remote_id: String(snapshot.external_id || ""),
    title: String(snapshot.title || ""),
    slug: String(snapshot.slug || ""),
    dirty: 1,
    deleted_local: 0,
    deleted_remote: 0,
    action: "rollback_apply",
    direction: "local",
    message: `${itemKind} rolled back locally`,
    payload_json: {
      item_id: String(snapshot.id || ""),
      item_kind: String(itemKind || ""),
      status: String(snapshot.status || ""),
      external_id: String(snapshot.external_id || "")
    }
  });
}

export async function rollbackRevision(env, actor_user_id, revisionRow, note = ""){
  const snapshot = safeJsonParse(revisionRow?.snapshot_json, null);
  if(!snapshot || !snapshot.item_kind || !snapshot.id){
    return { ok:false, error:"invalid_snapshot" };
  }

  const itemKind = String(snapshot.item_kind || "");
  const itemId = String(snapshot.id || "");

  if(itemKind === "post"){
    const exists = await loadPostRow(env, itemId);
    if(!exists) return { ok:false, error:"post_not_found" };

    await applyPostSnapshot(env, snapshot);
    await markDirtyAfterRollback(env, "post", snapshot);
    const rev = await capturePostRevision(env, actor_user_id, itemId, "rollback_apply", note || `rollback from revision #${revisionRow.revision_no}`);

    await addSyncAuditLog(env, {
      direction: "system",
      kind: "post",
      local_id: itemId,
      action: "revision_rollback",
      status: "ok",
      message: "post rollback applied",
      payload_json: {
        source_revision_id: revisionRow.id,
        source_revision_no: revisionRow.revision_no,
        new_revision_no: rev?.revision_no || null
      }
    });

    return { ok:true, item_kind:"post", item_id:itemId, applied_revision_no: rev?.revision_no || null };
  }

  if(itemKind === "page"){
    const exists = await loadPageRow(env, itemId);
    if(!exists) return { ok:false, error:"page_not_found" };

    await applyPageSnapshot(env, snapshot);
    await markDirtyAfterRollback(env, "page", snapshot);
    const rev = await capturePageRevision(env, actor_user_id, itemId, "rollback_apply", note || `rollback from revision #${revisionRow.revision_no}`);

    await addSyncAuditLog(env, {
      direction: "system",
      kind: "page",
      local_id: itemId,
      action: "revision_rollback",
      status: "ok",
      message: "page rollback applied",
      payload_json: {
        source_revision_id: revisionRow.id,
        source_revision_no: revisionRow.revision_no,
        new_revision_no: rev?.revision_no || null
      }
    });

    return { ok:true, item_kind:"page", item_id:itemId, applied_revision_no: rev?.revision_no || null };
  }

  return { ok:false, error:"unsupported_item_kind" };
}

import { nowSec } from "../../../_lib.js";
import {
  requireBlogspotAccess,
  getBlogspotConfig,
  bloggerUrl,
  bloggerFetch,
  markMapDirty,
  makeId
} from "./_service.js";
import {
  capturePostRevision,
  capturePageRevision
} from "./revision_shared.js";

export async function requireDiffAccess(env, request, allowStaff = true){
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

export function normalizeHtml(v){
  return String(v || "").replace(/\r\n/g, "\n").trim();
}

export function normalizeText(v){
  return String(v || "").trim();
}

export function normalizeLabels(v){
  const arr = Array.isArray(v) ? v : [];
  return Array.from(new Set(arr.map(x => String(x || "").trim()).filter(Boolean))).sort();
}

export function arraysEqual(a, b){
  const aa = normalizeLabels(a);
  const bb = normalizeLabels(b);
  if(aa.length !== bb.length) return false;
  for(let i = 0; i < aa.length; i++){
    if(aa[i] !== bb[i]) return false;
  }
  return true;
}

export function shortHash(s){
  let h = 0;
  const str = String(s || "");
  for(let i = 0; i < str.length; i++){
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return String(h >>> 0);
}

export async function getLocalItem(env, item_kind, item_id){
  const kind = String(item_kind || "").trim().toLowerCase();
  const id = String(item_id || "").trim();
  if(!id) return null;

  if(kind === "post"){
    const row = await env.DB.prepare(`
      SELECT
        p.id, p.provider, p.account_id, p.external_id, p.blog_id, p.title, p.slug, p.status, p.url,
        p.content_html, p.content_text, p.labels_json, p.meta_json, p.published_at, p.updated_at, p.created_at,
        m.remote_id, m.remote_updated, m.last_synced_at, m.last_pushed_at,
        m.dirty, m.deleted_local, m.deleted_remote, m.approval_status, m.sync_state, m.sync_error
      FROM cms_posts p
      LEFT JOIN blogspot_post_map m
        ON m.local_id = p.id
       AND m.kind = 'post'
      WHERE p.id=?
      LIMIT 1
    `).bind(id).first();

    if(!row) return null;

    return {
      item_kind: "post",
      id: String(row.id || ""),
      provider: String(row.provider || "blogspot"),
      account_id: String(row.account_id || ""),
      external_id: String(row.external_id || row.remote_id || ""),
      blog_id: row.blog_id || null,
      title: String(row.title || ""),
      slug: String(row.slug || ""),
      status: String(row.status || "draft"),
      url: row.url || null,
      content_html: String(row.content_html || ""),
      content_text: row.content_text || null,
      labels_json: safeJsonParse(row.labels_json, []),
      meta_json: safeJsonParse(row.meta_json, {}),
      published_at: row.published_at != null ? Number(row.published_at || 0) : null,
      updated_at: row.updated_at != null ? Number(row.updated_at || 0) : null,
      created_at: Number(row.created_at || 0),
      map: {
        remote_id: String(row.remote_id || row.external_id || ""),
        remote_updated: String(row.remote_updated || ""),
        last_synced_at: Number(row.last_synced_at || 0),
        last_pushed_at: Number(row.last_pushed_at || 0),
        dirty: Number(row.dirty || 0),
        deleted_local: Number(row.deleted_local || 0),
        deleted_remote: Number(row.deleted_remote || 0),
        approval_status: String(row.approval_status || ""),
        sync_state: String(row.sync_state || ""),
        sync_error: String(row.sync_error || "")
      }
    };
  }

  if(kind === "page"){
    const row = await env.DB.prepare(`
      SELECT
        p.id, p.provider, p.account_id, p.external_id, p.blog_id, p.title, p.slug, p.status, p.url,
        p.content_html, p.meta_json, p.published_at, p.updated_at, p.created_at,
        m.remote_id, m.remote_updated, m.last_synced_at, m.last_pushed_at,
        m.dirty, m.deleted_local, m.deleted_remote, m.approval_status, m.sync_state, m.sync_error
      FROM cms_pages p
      LEFT JOIN blogspot_post_map m
        ON m.local_id = p.id
       AND m.kind = 'page'
      WHERE p.id=?
      LIMIT 1
    `).bind(id).first();

    if(!row) return null;

    return {
      item_kind: "page",
      id: String(row.id || ""),
      provider: String(row.provider || "blogspot"),
      account_id: String(row.account_id || ""),
      external_id: String(row.external_id || row.remote_id || ""),
      blog_id: row.blog_id || null,
      title: String(row.title || ""),
      slug: String(row.slug || ""),
      status: String(row.status || "draft"),
      url: row.url || null,
      content_html: String(row.content_html || ""),
      meta_json: safeJsonParse(row.meta_json, {}),
      published_at: row.published_at != null ? Number(row.published_at || 0) : null,
      updated_at: row.updated_at != null ? Number(row.updated_at || 0) : null,
      created_at: Number(row.created_at || 0),
      map: {
        remote_id: String(row.remote_id || row.external_id || ""),
        remote_updated: String(row.remote_updated || ""),
        last_synced_at: Number(row.last_synced_at || 0),
        last_pushed_at: Number(row.last_pushed_at || 0),
        dirty: Number(row.dirty || 0),
        deleted_local: Number(row.deleted_local || 0),
        deleted_remote: Number(row.deleted_remote || 0),
        approval_status: String(row.approval_status || ""),
        sync_state: String(row.sync_state || ""),
        sync_error: String(row.sync_error || "")
      }
    };
  }

  return null;
}

export async function getRemoteItem(env, item_kind, localItem){
  const kind = String(item_kind || "").trim().toLowerCase();
  const cfg = await getBlogspotConfig(env);

  if(!cfg.enabled || !cfg.blog_id || !cfg.api_key){
    return { ok:false, error:"blogspot_config_missing" };
  }

  const remoteId = String(localItem?.external_id || localItem?.map?.remote_id || "").trim();
  if(!remoteId){
    return { ok:false, error:"remote_id_missing" };
  }

  const endpoint = kind === "post"
    ? "/posts/" + encodeURIComponent(remoteId)
    : kind === "page"
    ? "/pages/" + encodeURIComponent(remoteId)
    : "";

  if(!endpoint){
    return { ok:false, error:"unsupported_item_kind" };
  }

  const url = bloggerUrl(cfg.blog_id, endpoint, {}, cfg.api_key);
  const res = await bloggerFetch(url, { method:"GET" });

  if(!res.ok){
    if(Number(res.status) === 404){
      return { ok:false, error:"remote_not_found", http:404 };
    }
    return {
      ok:false,
      error:"remote_fetch_failed",
      http:Number(res.status || 500),
      body: res.data || res.text || ""
    };
  }

  const d = res.data || {};

  if(kind === "post"){
    return {
      ok:true,
      item: {
        item_kind: "post",
        id: String(d.id || remoteId),
        external_id: String(d.id || remoteId),
        title: String(d.title || ""),
        slug: String(d.url || ""),
        status: d.status === "LIVE" ? "published" : "draft",
        url: d.url || null,
        content_html: String(d.content || ""),
        labels_json: Array.isArray(d.labels) ? d.labels.map(x => String(x || "")) : [],
        published_at: d.published ? Math.floor(new Date(d.published).getTime() / 1000) : null,
        updated_at: d.updated ? Math.floor(new Date(d.updated).getTime() / 1000) : null,
        updated_raw: String(d.updated || "")
      }
    };
  }

  return {
    ok:true,
    item: {
      item_kind: "page",
      id: String(d.id || remoteId),
      external_id: String(d.id || remoteId),
      title: String(d.title || ""),
      slug: String(d.url || ""),
      status: d.status === "LIVE" ? "published" : "draft",
      url: d.url || null,
      content_html: String(d.content || ""),
      published_at: d.published ? Math.floor(new Date(d.published).getTime() / 1000) : null,
      updated_at: d.updated ? Math.floor(new Date(d.updated).getTime() / 1000) : null,
      updated_raw: String(d.updated || "")
    }
  };
}

export function buildDiff(localItem, remoteItem){
  const item_kind = String(localItem?.item_kind || remoteItem?.item_kind || "");
  const fields = [];

  const pushField = (field, localValue, remoteValue, equal) => {
    fields.push({
      field,
      equal: !!equal,
      local: localValue,
      remote: remoteValue
    });
  };

  pushField(
    "title",
    String(localItem?.title || ""),
    String(remoteItem?.title || ""),
    normalizeText(localItem?.title) === normalizeText(remoteItem?.title)
  );

  pushField(
    "status",
    String(localItem?.status || ""),
    String(remoteItem?.status || ""),
    normalizeText(localItem?.status) === normalizeText(remoteItem?.status)
  );

  pushField(
    "url",
    String(localItem?.url || ""),
    String(remoteItem?.url || ""),
    normalizeText(localItem?.url) === normalizeText(remoteItem?.url)
  );

  pushField(
    "content_html",
    {
      length: normalizeHtml(localItem?.content_html).length,
      hash: shortHash(normalizeHtml(localItem?.content_html)),
      preview: normalizeHtml(localItem?.content_html).slice(0, 300)
    },
    {
      length: normalizeHtml(remoteItem?.content_html).length,
      hash: shortHash(normalizeHtml(remoteItem?.content_html)),
      preview: normalizeHtml(remoteItem?.content_html).slice(0, 300)
    },
    normalizeHtml(localItem?.content_html) === normalizeHtml(remoteItem?.content_html)
  );

  if(item_kind === "post"){
    pushField(
      "labels_json",
      normalizeLabels(localItem?.labels_json),
      normalizeLabels(remoteItem?.labels_json),
      arraysEqual(localItem?.labels_json, remoteItem?.labels_json)
    );
  }

  const different_count = fields.filter(x => !x.equal).length;

  let resolution_hint = "in_sync";
  if(different_count > 0) resolution_hint = "review_required";
  if(different_count > 0 && Number(localItem?.map?.dirty || 0) === 1) resolution_hint = "prefer_local_review";
  if(different_count > 0 && String(localItem?.map?.remote_updated || "") && String(remoteItem?.updated_raw || "")){
    if(String(localItem.map.remote_updated) !== String(remoteItem.updated_raw)){
      resolution_hint = "remote_changed_after_sync";
    }
  }

  return {
    item_kind,
    different_count,
    resolution_hint,
    fields
  };
}

export async function setMapState(env, kind, localId, patch = {}){
  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO blogspot_post_map (
      local_id,
      remote_id,
      kind,
      title,
      slug,
      remote_updated,
      last_synced_at,
      last_pushed_at,
      dirty,
      deleted_local,
      deleted_remote,
      approval_status,
      sync_state,
      sync_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(local_id) DO UPDATE SET
      remote_id = excluded.remote_id,
      kind = excluded.kind,
      title = excluded.title,
      slug = excluded.slug,
      remote_updated = excluded.remote_updated,
      last_synced_at = excluded.last_synced_at,
      last_pushed_at = excluded.last_pushed_at,
      dirty = excluded.dirty,
      deleted_local = excluded.deleted_local,
      deleted_remote = excluded.deleted_remote,
      approval_status = excluded.approval_status,
      sync_state = excluded.sync_state,
      sync_error = excluded.sync_error
  `).bind(
    String(localId || ""),
    String(patch.remote_id || ""),
    String(kind || ""),
    String(patch.title || ""),
    String(patch.slug || ""),
    String(patch.remote_updated || ""),
    patch.last_synced_at != null ? Number(patch.last_synced_at || 0) : now,
    patch.last_pushed_at != null ? Number(patch.last_pushed_at || 0) : null,
    Number(patch.dirty || 0),
    Number(patch.deleted_local || 0),
    Number(patch.deleted_remote || 0),
    String(patch.approval_status || ""),
    String(patch.sync_state || ""),
    String(patch.sync_error || "")
  ).run();
}

export async function resolveKeepLocal(env, actorUserId, localItem, remoteItem, note = ""){
  const kind = String(localItem.item_kind || "");
  await markMapDirty(env, kind, localItem.id, {
    remote_id: String(remoteItem?.external_id || localItem?.external_id || ""),
    title: String(localItem.title || ""),
    slug: String(localItem.slug || ""),
    remote_updated: String(remoteItem?.updated_raw || ""),
    last_synced_at: nowSec(),
    dirty: 1,
    deleted_local: 0,
    deleted_remote: 0,
    action: "conflict_resolve_keep_local",
    direction: "local",
    message: note || "conflict resolved: keep local",
    payload_json: {
      resolver: "keep_local",
      item_kind: kind,
      item_id: localItem.id
    }
  });

  await setMapState(env, kind, localItem.id, {
    remote_id: String(remoteItem?.external_id || localItem?.external_id || ""),
    title: String(localItem.title || ""),
    slug: String(localItem.slug || ""),
    remote_updated: String(remoteItem?.updated_raw || ""),
    last_synced_at: nowSec(),
    last_pushed_at: Number(localItem?.map?.last_pushed_at || 0),
    dirty: 1,
    deleted_local: 0,
    deleted_remote: 0,
    approval_status: String(localItem?.map?.approval_status || ""),
    sync_state: "resolved_keep_local",
    sync_error: ""
  });

  return { ok:true, action:"keep_local" };
}

export async function resolvePullRemote(env, actorUserId, localItem, remoteItem, note = ""){
  const kind = String(localItem.item_kind || "");

  if(kind === "post"){
    await capturePostRevision(env, actorUserId, localItem.id, "conflict_pull_remote_before", note || "before pull remote");
    await env.DB.prepare(`
      UPDATE cms_posts
      SET title=?,
          status=?,
          url=?,
          content_html=?,
          labels_json=?,
          external_id=?,
          published_at=?,
          updated_at=?
      WHERE id=?
    `).bind(
      String(remoteItem.title || ""),
      String(remoteItem.status || "draft"),
      remoteItem.url || null,
      String(remoteItem.content_html || ""),
      JSON.stringify(Array.isArray(remoteItem.labels_json) ? remoteItem.labels_json : []),
      String(remoteItem.external_id || localItem.external_id || ""),
      remoteItem.published_at != null ? Number(remoteItem.published_at || 0) : null,
      nowSec(),
      String(localItem.id)
    ).run();

    await capturePostRevision(env, actorUserId, localItem.id, "conflict_pull_remote_after", note || "after pull remote");
  }else if(kind === "page"){
    await capturePageRevision(env, actorUserId, localItem.id, "conflict_pull_remote_before", note || "before pull remote");
    await env.DB.prepare(`
      UPDATE cms_pages
      SET title=?,
          status=?,
          url=?,
          content_html=?,
          external_id=?,
          published_at=?,
          updated_at=?
      WHERE id=?
    `).bind(
      String(remoteItem.title || ""),
      String(remoteItem.status || "draft"),
      remoteItem.url || null,
      String(remoteItem.content_html || ""),
      String(remoteItem.external_id || localItem.external_id || ""),
      remoteItem.published_at != null ? Number(remoteItem.published_at || 0) : null,
      nowSec(),
      String(localItem.id)
    ).run();

    await capturePageRevision(env, actorUserId, localItem.id, "conflict_pull_remote_after", note || "after pull remote");
  }else{
    return { ok:false, error:"unsupported_item_kind" };
  }

  await setMapState(env, kind, localItem.id, {
    remote_id: String(remoteItem?.external_id || localItem?.external_id || ""),
    title: String(remoteItem.title || ""),
    slug: String(localItem.slug || ""),
    remote_updated: String(remoteItem?.updated_raw || ""),
    last_synced_at: nowSec(),
    last_pushed_at: Number(localItem?.map?.last_pushed_at || 0),
    dirty: 0,
    deleted_local: 0,
    deleted_remote: 0,
    approval_status: String(localItem?.map?.approval_status || ""),
    sync_state: "resolved_pull_remote",
    sync_error: ""
  });

  await markMapDirty(env, kind, localItem.id, {
    remote_id: String(remoteItem?.external_id || localItem?.external_id || ""),
    title: String(remoteItem.title || ""),
    slug: String(localItem.slug || ""),
    remote_updated: String(remoteItem?.updated_raw || ""),
    last_synced_at: nowSec(),
    last_pushed_at: Number(localItem?.map?.last_pushed_at || 0),
    dirty: 0,
    deleted_local: 0,
    deleted_remote: 0,
    action: "conflict_resolve_pull_remote",
    direction: "pull",
    message: note || "conflict resolved: pull remote",
    payload_json: {
      resolver: "pull_remote",
      item_kind: kind,
      item_id: localItem.id
    }
  });

  return { ok:true, action:"pull_remote" };
}

export async function resolveMarkResolved(env, actorUserId, localItem, remoteItem, note = ""){
  const kind = String(localItem.item_kind || "");

  await setMapState(env, kind, localItem.id, {
    remote_id: String(remoteItem?.external_id || localItem?.external_id || ""),
    title: String(localItem.title || ""),
    slug: String(localItem.slug || ""),
    remote_updated: String(remoteItem?.updated_raw || ""),
    last_synced_at: nowSec(),
    last_pushed_at: Number(localItem?.map?.last_pushed_at || 0),
    dirty: Number(localItem?.map?.dirty || 0),
    deleted_local: 0,
    deleted_remote: 0,
    approval_status: String(localItem?.map?.approval_status || ""),
    sync_state: "resolved_manual",
    sync_error: ""
  });

  await addConflictAuditLog(env, {
    kind,
    local_id: localItem.id,
    action: "conflict_mark_resolved",
    message: note || "conflict marked resolved",
    payload_json: {
      resolver: "mark_resolved",
      item_kind: kind,
      item_id: localItem.id
    }
  });

  return { ok:true, action:"mark_resolved" };
}

export async function addConflictAuditLog(env, row){
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
      String(row.action || "conflict"),
      String(row.status || "ok"),
      String(row.message || ""),
      JSON.stringify(row.payload_json || {}),
      nowSec()
    ).run();
  }catch{}
}

import { json } from "../../../_lib.js";
import {
  requireDiffAccess,
  getLocalItem,
  getRemoteItem,
  buildDiff,
  setMapState
} from "./diff_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireDiffAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const item_kind = String(url.searchParams.get("item_kind") || "").trim().toLowerCase();
  const item_id = String(url.searchParams.get("item_id") || "").trim();

  if(!item_kind || !item_id){
    return json(400, "invalid_input", { error:"item_kind_item_id_required" });
  }

  const localItem = await getLocalItem(env, item_kind, item_id);
  if(!localItem){
    return json(404, "not_found", { error:"local_item_not_found" });
  }

  const remoteRes = await getRemoteItem(env, item_kind, localItem);
  if(!remoteRes.ok){
    if(remoteRes.error === "remote_not_found"){
      await setMapState(env, item_kind, item_id, {
        remote_id: String(localItem.external_id || localItem?.map?.remote_id || ""),
        title: String(localItem.title || ""),
        slug: String(localItem.slug || ""),
        remote_updated: "",
        last_synced_at: Number(localItem?.map?.last_synced_at || 0),
        last_pushed_at: Number(localItem?.map?.last_pushed_at || 0),
        dirty: Number(localItem?.map?.dirty || 0),
        deleted_local: 0,
        deleted_remote: 1,
        approval_status: String(localItem?.map?.approval_status || ""),
        sync_state: "conflict_remote_missing",
        sync_error: "remote_not_found"
      });

      return json(200, "ok", {
        local: localItem,
        remote: null,
        diff: null,
        remote_deleted: true,
        message: "remote_not_found"
      });
    }

    return json(502, "server_error", {
      error: remoteRes.error || "remote_fetch_failed",
      http: Number(remoteRes.http || 500),
      body: remoteRes.body || ""
    });
  }

  const remoteItem = remoteRes.item;
  const diff = buildDiff(localItem, remoteItem);

  const syncState = diff.different_count > 0 ? "conflict_possible" : "in_sync";
  await setMapState(env, item_kind, item_id, {
    remote_id: String(remoteItem.external_id || localItem.external_id || ""),
    title: String(localItem.title || ""),
    slug: String(localItem.slug || ""),
    remote_updated: String(remoteItem.updated_raw || ""),
    last_synced_at: Math.floor(Date.now() / 1000),
    last_pushed_at: Number(localItem?.map?.last_pushed_at || 0),
    dirty: Number(localItem?.map?.dirty || 0),
    deleted_local: 0,
    deleted_remote: 0,
    approval_status: String(localItem?.map?.approval_status || ""),
    sync_state: syncState,
    sync_error: diff.different_count > 0 ? "diff_detected" : ""
  });

  return json(200, "ok", {
    local: localItem,
    remote: remoteItem,
    diff,
    remote_deleted: false
  });
}

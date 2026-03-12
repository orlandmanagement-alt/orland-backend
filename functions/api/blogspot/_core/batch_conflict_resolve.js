import { json, readJson } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";
import {
  getLocalItem,
  getRemoteItem,
  resolveKeepLocal,
  resolvePullRemote,
  resolveMarkResolved
} from "./diff_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const resolver = String(body.resolver || "").trim().toLowerCase();
  const note = String(body.note || "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if(!["keep_local", "pull_remote", "mark_resolved"].includes(resolver)){
    return json(400, "invalid_input", { error:"invalid_resolver" });
  }

  if(!items.length){
    return json(400, "invalid_input", { error:"items_required" });
  }

  const cleanItems = items
    .map(x => ({
      item_kind: String(x?.item_kind || "").trim().toLowerCase(),
      item_id: String(x?.item_id || "").trim()
    }))
    .filter(x => x.item_kind && x.item_id)
    .slice(0, 100);

  if(!cleanItems.length){
    return json(400, "invalid_input", { error:"no_valid_items" });
  }

  const results = [];

  for(const item of cleanItems){
    try{
      const localItem = await getLocalItem(env, item.item_kind, item.item_id);
      if(!localItem){
        results.push({
          item_kind: item.item_kind,
          item_id: item.item_id,
          ok: false,
          error: "local_item_not_found"
        });
        continue;
      }

      const remoteRes = await getRemoteItem(env, item.item_kind, localItem);
      if(!remoteRes.ok && resolver !== "mark_resolved"){
        results.push({
          item_kind: item.item_kind,
          item_id: item.item_id,
          ok: false,
          error: remoteRes.error || "remote_fetch_failed"
        });
        continue;
      }

      const remoteItem = remoteRes.ok ? remoteRes.item : null;

      let r = null;
      if(resolver === "keep_local"){
        r = await resolveKeepLocal(env, a.uid || null, localItem, remoteItem, note);
      }else if(resolver === "pull_remote"){
        r = await resolvePullRemote(env, a.uid || null, localItem, remoteItem, note);
      }else{
        r = await resolveMarkResolved(env, a.uid || null, localItem, remoteItem, note);
      }

      results.push({
        item_kind: item.item_kind,
        item_id: item.item_id,
        ok: !!r?.ok,
        action: r?.action || "",
        error: r?.error || ""
      });
    }catch(e){
      results.push({
        item_kind: item.item_kind,
        item_id: item.item_id,
        ok: false,
        error: String(e?.message || e)
      });
    }
  }

  const success = results.filter(x => x.ok).length;
  const failed = results.length - success;

  return json(200, "ok", {
    resolver,
    total: results.length,
    success,
    failed,
    items: results
  });
}

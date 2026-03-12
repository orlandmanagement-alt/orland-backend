import { json, readJson } from "../../../_lib.js";
import {
  requireDiffAccess,
  getLocalItem,
  getRemoteItem,
  resolveKeepLocal,
  resolvePullRemote,
  resolveMarkResolved
} from "./diff_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireDiffAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const item_kind = String(body.item_kind || "").trim().toLowerCase();
  const item_id = String(body.item_id || "").trim();
  const resolver = String(body.resolver || "").trim().toLowerCase();
  const note = String(body.note || "").trim();

  if(!item_kind || !item_id || !resolver){
    return json(400, "invalid_input", { error:"item_kind_item_id_resolver_required" });
  }

  if(!["keep_local", "pull_remote", "mark_resolved"].includes(resolver)){
    return json(400, "invalid_input", { error:"invalid_resolver" });
  }

  const localItem = await getLocalItem(env, item_kind, item_id);
  if(!localItem){
    return json(404, "not_found", { error:"local_item_not_found" });
  }

  const remoteRes = await getRemoteItem(env, item_kind, localItem);
  if(!remoteRes.ok && resolver !== "mark_resolved"){
    return json(400, "invalid_input", { error: remoteRes.error || "remote_fetch_failed" });
  }

  const remoteItem = remoteRes.ok ? remoteRes.item : null;

  let result = null;
  if(resolver === "keep_local"){
    result = await resolveKeepLocal(env, a.uid || null, localItem, remoteItem, note);
  }else if(resolver === "pull_remote"){
    result = await resolvePullRemote(env, a.uid || null, localItem, remoteItem, note);
  }else{
    result = await resolveMarkResolved(env, a.uid || null, localItem, remoteItem, note);
  }

  if(!result?.ok){
    return json(400, "invalid_input", { error: result?.error || "resolve_failed" });
  }

  return json(200, "ok", {
    resolved: true,
    resolver,
    item_kind,
    item_id
  });
}

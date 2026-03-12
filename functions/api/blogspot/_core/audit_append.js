import { json, readJson } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";
import { appendLedgerEvent } from "./audit_ledger_shared.js";

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const event_type = String(body.event_type || "").trim();
  if(!event_type){
    return json(400, "invalid_input", { error:"event_type_required" });
  }

  const r = await appendLedgerEvent(env, {
    site_id: body.site_id || null,
    event_type,
    item_kind: body.item_kind || null,
    item_id: body.item_id || null,
    actor_user_id: a.uid || null,
    payload: body.payload_json && typeof body.payload_json === "object" ? body.payload_json : {}
  });

  return json(200, "ok", {
    appended: true,
    ...r
  });
}

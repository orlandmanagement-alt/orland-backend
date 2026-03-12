import { json } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";
import { verifyLedger } from "./audit_ledger_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(10000, Number(url.searchParams.get("limit") || "1000")));

  return json(200, "ok", await verifyLedger(env, limit));
}

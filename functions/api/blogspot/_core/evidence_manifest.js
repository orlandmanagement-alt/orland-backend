import { json } from "../../../_lib.js";
import { requireEvidenceAccess, parseRange } from "./evidence_shared.js";

export async function onRequestGet({ request, env }){
  const a = await requireEvidenceAccess(env, request);
  if(!a.ok) return a.res;

  const range = parseRange(request);
  const url = new URL(request.url);
  const base = url.origin;

  return json(200, "ok", {
    generated_at: Math.floor(Date.now() / 1000),
    range,
    files: [
      { kind:"snapshot_json", url: `${base}/api/blogspot/evidence_snapshot${url.search}` },
      { kind:"logs_csv", url: `${base}/api/blogspot/evidence_logs_csv${url.search}` },
      { kind:"approvals_csv", url: `${base}/api/blogspot/evidence_approvals_csv${url.search}` },
      { kind:"delete_requests_csv", url: `${base}/api/blogspot/evidence_delete_requests_csv${url.search}` },
      { kind:"risk_csv", url: `${base}/api/blogspot/evidence_risk_csv${url.search}` }
    ]
  });
}

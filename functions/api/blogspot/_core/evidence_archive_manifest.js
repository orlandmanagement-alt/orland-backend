import {
  requireEvidenceBundleAccess,
  parseRange,
  stableJson,
  sha256Hex,
  hmacSha256Hex,
  buildSnapshotSection,
  buildLogsSection,
  buildApprovalsSection,
  buildDeleteRequestsSection,
  buildRiskRegisterSection
} from "./evidence_bundle_shared.js";
import { json } from "../../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireEvidenceBundleAccess(env, request);
  if(!a.ok) return a.res;

  const range = parseRange(request);
  const generated_at = Math.floor(Date.now() / 1000);

  const [
    snapshot,
    logs,
    approvals,
    delete_requests,
    risk_register
  ] = await Promise.all([
    buildSnapshotSection(env, range),
    buildLogsSection(env, range),
    buildApprovalsSection(env),
    buildDeleteRequestsSection(env, range),
    buildRiskRegisterSection(env)
  ]);

  const checksums = {
    snapshot: await sha256Hex(stableJson(snapshot)),
    logs: await sha256Hex(stableJson(logs)),
    approvals: await sha256Hex(stableJson(approvals)),
    delete_requests: await sha256Hex(stableJson(delete_requests)),
    risk_register: await sha256Hex(stableJson(risk_register))
  };

  const summary = {
    generated_at,
    range,
    counts: {
      logs: Array.isArray(logs) ? logs.length : 0,
      approvals: Array.isArray(approvals) ? approvals.length : 0,
      delete_requests: Array.isArray(delete_requests) ? delete_requests.length : 0,
      risk_register: Array.isArray(risk_register) ? risk_register.length : 0
    },
    checksums
  };

  const signaturePayload = stableJson({
    archive_version: "v1",
    generated_at,
    range,
    checksums,
    counts: summary.counts
  });

  let signature = {
    mode: "unsigned",
    algorithm: null,
    value: null,
    key_hint: null
  };

  const secret = String(env.BLOGSPOT_EVIDENCE_SIGNING_SECRET || "").trim();
  if(secret){
    signature = {
      mode: "hmac",
      algorithm: "HMAC-SHA256",
      value: await hmacSha256Hex(secret, signaturePayload),
      key_hint: "env.BLOGSPOT_EVIDENCE_SIGNING_SECRET"
    };
  }

  return json(200, "ok", {
    archive: {
      name: "blogspot_evidence_bundle",
      version: "v1"
    },
    summary,
    signature
  });
}

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

  const sectionPayloads = {
    snapshot,
    logs,
    approvals,
    delete_requests,
    risk_register
  };

  const checksums = {};
  for(const [k, v] of Object.entries(sectionPayloads)){
    checksums[k] = await sha256Hex(stableJson(v));
  }

  const summary = {
    snapshot_hash: checksums.snapshot,
    logs_hash: checksums.logs,
    approvals_hash: checksums.approvals,
    delete_requests_hash: checksums.delete_requests,
    risk_register_hash: checksums.risk_register,
    logs_count: Array.isArray(logs) ? logs.length : 0,
    approvals_count: Array.isArray(approvals) ? approvals.length : 0,
    delete_requests_count: Array.isArray(delete_requests) ? delete_requests.length : 0,
    risk_register_count: Array.isArray(risk_register) ? risk_register.length : 0
  };

  const signPayload = stableJson({
    archive_version: "v1",
    generated_at,
    range,
    checksums,
    summary
  });

  let signature = {
    mode: "unsigned",
    algorithm: null,
    value: null,
    key_hint: null
  };

  const secret = String(env.BLOGSPOT_EVIDENCE_SIGNING_SECRET || "").trim();
  if(secret){
    const value = await hmacSha256Hex(secret, signPayload);
    signature = {
      mode: "hmac",
      algorithm: "HMAC-SHA256",
      value,
      key_hint: "env.BLOGSPOT_EVIDENCE_SIGNING_SECRET"
    };
  }

  const bundle = {
    archive: {
      name: "blogspot_evidence_bundle",
      version: "v1",
      generated_at,
      generator: "blogspot_evidence_bundle.js"
    },
    range,
    summary,
    sections: sectionPayloads,
    checksums,
    signature
  };

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="blogspot_evidence_bundle_v1.json"`
    }
  });
}

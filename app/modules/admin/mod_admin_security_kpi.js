import { getJson } from "../../js/admin_security_helper.js";

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = String(value ?? "0");
}

export default async function(){
  const info = document.getElementById("securityKpiInfo");
  const res = await getJson("/functions/api/admin/security_kpi_get");

  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load security KPI.";
    return;
  }

  const s = res.data?.summary || {};
  setText("kpiActiveSessions", s.active_sessions || 0);
  setText("kpiBlockedIps", s.active_blocked_ips || 0);
  setText("kpiLockedUsers", s.locked_users || 0);
  setText("kpiAudit24h", s.audit_events_24h || 0);
  setText("kpiFailedAuth24h", s.failed_auth_24h || 0);

  if(info) info.textContent = "Security KPI loaded.";
}

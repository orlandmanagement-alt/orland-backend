import { getJson } from "../../js/admin_security_helper.js";
import { triggerAdminCsvExport } from "../../js/admin_export_helper.js";

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = String(value ?? "0");
}

export default async function(){
  const info = document.getElementById("authRiskInfo");
  const res = await getJson("/functions/api/admin/auth_risk_monitor_get");

  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load auth risk monitor.";
    return;
  }

  const s = res.data?.summary || {};
  setText("riskFailedLogins", s.failed_logins_24h || 0);
  setText("riskLoginSuccess", s.login_success_24h || 0);
  setText("riskBlockedIps", s.active_blocked_ips || 0);
  setText("riskLockedUsers", s.locked_users || 0);

  const exportBtn = document.getElementById("adminAuthRiskExportBtn");
  if(exportBtn){
    exportBtn.addEventListener("click", () => {
      triggerAdminCsvExport("/functions/api/admin/auth_risk_monitor_export_csv");
    });
  }

  if(info) info.textContent = "Auth risk summary loaded.";
}

import { getJson } from "../../js/admin_security_helper.js";
import { showAdminNotice } from "../../js/admin_notice.js";

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = String(value ?? "0");
}

export default async function(){
  const info = document.getElementById("securityHomeInfo");
  const res = await getJson("/functions/api/admin/security_kpi_get");

  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load security home.";
    showAdminNotice(res?.data?.message || "Failed to load security KPI.", "error");
    return;
  }

  const s = res.data?.summary || {};
  setText("homeActiveSessions", s.active_sessions || 0);
  setText("homeBlockedIps", s.active_blocked_ips || 0);
  setText("homeLockedUsers", s.locked_users || 0);
  setText("homeFailedAuth24h", s.failed_auth_24h || 0);

  if(info) info.textContent = "Security home loaded.";
}

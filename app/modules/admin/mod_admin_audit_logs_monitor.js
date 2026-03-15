import { getAdminQueryState, renderAdminPaging } from "../../js/admin_monitor_helper.js";
import { getJson } from "../../js/admin_security_helper.js";
import { triggerAdminCsvExport } from "../../js/admin_export_helper.js";

let offset = 0;

async function load(){
  const info = document.getElementById("auditLogsInfo");
  const list = document.getElementById("auditLogsList");
  const q = getAdminQueryState("adminAuditFilterForm", "adminAuditSearch", "adminAuditLimit");
  const search = q.getSearch();
  const limit = q.getLimit();

  const res = await getJson(`/functions/api/admin/audit_logs_monitor_get?q=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`);

  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load audit logs.";
    return;
  }

  const rows = res.data?.items || [];
  const paging = res.data?.paging || {};

  if(info) info.textContent = `Loaded ${rows.length} audit log row(s).`;

  if(list){
    list.innerHTML = rows.map(x => `
      <li>
        <strong>${x.action || "-"}</strong>
        • route=${x.route || "-"}
        • status=${x.http_status || "-"}
        • target=${x.target_id || "-"}
        • at=${x.created_at || "-"}
        • <a href="/app/pages/admin/audit-log-detail.html?id=${encodeURIComponent(x.id || "")}">detail</a>
      </li>
    `).join("");
  }

  renderAdminPaging("auditLogsPaging", paging, async () => {
    offset = Math.max(0, Number(paging.prev_offset || 0));
    await load();
  }, async () => {
    offset = Number(paging.next_offset || 0);
    await load();
  });
}

export default async function(){
  const q = getAdminQueryState("adminAuditFilterForm", "adminAuditSearch", "adminAuditLimit");
  q.form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    offset = 0;
    await load();
  });

  document.getElementById("adminAuditExportBtn")?.addEventListener("click", () => {
    triggerAdminCsvExport("/functions/api/admin/audit_logs_monitor_export_csv", {
      q: q.getSearch()
    });
  });

  await load();
}

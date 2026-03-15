import { getJson } from "../../js/admin_security_helper.js";
import { triggerAdminCsvExport } from "../../js/admin_export_helper.js";

async function load(){
  const info = document.getElementById("requestCountersInfo");
  const list = document.getElementById("requestCountersList");
  const q = String(document.getElementById("adminRequestCountersSearch")?.value || "").trim();
  const limit = Number(document.getElementById("adminRequestCountersLimit")?.value || 20);

  const res = await getJson(`/functions/api/admin/request_counters_monitor_get?q=${encodeURIComponent(q)}&limit=${limit}`);

  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load request counters.";
    return;
  }

  const rows = res.data?.items || [];
  if(info) info.textContent = `Loaded ${rows.length} counter row(s).`;

  if(list){
    list.innerHTML = rows.map(x => `
      <li>
        <strong>${x.k || "-"}</strong>
        • count=${x.count || 0}
        • window_start=${x.window_start || "-"}
        • updated_at=${x.updated_at || "-"}
      </li>
    `).join("");
  }
}

export default async function(){
  document.getElementById("adminRequestCountersFilterForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await load();
  });

  document.getElementById("adminRequestCountersExportBtn")?.addEventListener("click", () => {
    const q = String(document.getElementById("adminRequestCountersSearch")?.value || "").trim();
    triggerAdminCsvExport("/functions/api/admin/request_counters_monitor_export_csv", { q });
  });

  await load();
}

import { triggerAdminCsvExport } from "../../js/admin_export_helper.js";

async function getJson(url){
  const res = await fetch(url, { credentials: "include" });
  const text = await res.text();
  try{
    return JSON.parse(text);
  }catch{
    return { status: "error", data: [] };
  }
}

async function load(){
  const info = document.getElementById("projectPipelineMonitorInfo");
  const list = document.getElementById("projectPipelineMonitorList");

  const res = await getJson("/functions/api/admin/project_pipeline_monitor_get");
  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load project pipeline monitor.";
    return;
  }

  const rows = res.data?.items || [];
  if(info) info.textContent = `Loaded ${rows.length} project pipeline row(s).`;

  if(list){
    list.innerHTML = rows.map(x => `
      <li>
        <strong>${x.project_title || x.project_id}</strong>
        • apps=${x.applications}
        • shortlists=${x.shortlists}
        • invites=${x.invites}
        • bookings=${x.bookings}
      </li>
    `).join("");
  }
}

export default async function(){
  document.getElementById("adminPipelineExportBtn")?.addEventListener("click", () => {
    triggerAdminCsvExport("/functions/api/admin/project_pipeline_monitor_export_csv");
  });

  await load();
}

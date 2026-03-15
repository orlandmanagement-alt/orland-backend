import { getAdminQueryState, renderAdminPaging } from "../../js/admin_monitor_helper.js";
import { triggerAdminCsvExport } from "../../js/admin_export_helper.js";

async function getJson(url){
  const res = await fetch(url, { credentials: "include" });
  const text = await res.text();
  try{ return JSON.parse(text); }catch{ return { status: "error", data: [] }; }
}

let offset = 0;

async function load(){
  const info = document.getElementById("projectsMonitorInfo");
  const list = document.getElementById("projectsMonitorList");
  const q = getAdminQueryState("adminProjectsFilterForm", "adminProjectsSearch", "adminProjectsLimit");
  const search = q.getSearch();
  const limit = q.getLimit();

  const url = `/functions/api/admin/projects_monitor_get?q=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`;
  const res = await getJson(url);

  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load projects monitor.";
    return;
  }

  const rows = res.data?.items || [];
  const paging = res.data?.paging || {};
  if(info) info.textContent = `Loaded ${rows.length} project(s).`;

  if(list){
    list.innerHTML = rows.map(x => `<li><strong>${x.title || x.id}</strong> • ${x.status || "-"} • ${x.organization_name || "-"}</li>`).join("");
  }

  renderAdminPaging("projectsMonitorPaging", paging, async () => {
    offset = Math.max(0, Number(paging.prev_offset || 0));
    await load();
  }, async () => {
    offset = Number(paging.next_offset || 0);
    await load();
  });
}

export default async function(){
  const q = getAdminQueryState("adminProjectsFilterForm", "adminProjectsSearch", "adminProjectsLimit");

  q.form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    offset = 0;
    await load();
  });

  document.getElementById("adminProjectsExportBtn")?.addEventListener("click", () => {
    triggerAdminCsvExport("/functions/api/admin/projects_monitor_export_csv", {
      q: q.getSearch()
    });
  });

  await load();
}

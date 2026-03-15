import { getAdminQueryState, renderAdminPaging } from "../../js/admin_monitor_helper.js";
import { triggerAdminCsvExport } from "../../js/admin_export_helper.js";

async function getJson(url){
  const res = await fetch(url, { credentials: "include" });
  const text = await res.text();
  try{ return JSON.parse(text); }catch{ return { status: "error", data: [] }; }
}

let offset = 0;

async function load(){
  const info = document.getElementById("invitesMonitorInfo");
  const list = document.getElementById("invitesMonitorList");
  const q = getAdminQueryState("adminInvitesFilterForm", "adminInvitesSearch", "adminInvitesLimit");
  const search = q.getSearch();
  const limit = q.getLimit();

  const url = `/functions/api/admin/invites_monitor_get?q=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`;
  const res = await getJson(url);

  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load invites monitor.";
    return;
  }

  const rows = res.data?.items || [];
  const paging = res.data?.paging || {};
  if(info) info.textContent = `Loaded ${rows.length} invite(s).`;

  if(list){
    list.innerHTML = rows.map(x => `<li><strong>${x.project_title || "-"}</strong> • ${x.role_name || "-"} • ${x.talent_name || x.talent_user_id || "-"} • ${x.status || "-"}</li>`).join("");
  }

  renderAdminPaging("invitesMonitorPaging", paging, async () => {
    offset = Math.max(0, Number(paging.prev_offset || 0));
    await load();
  }, async () => {
    offset = Number(paging.next_offset || 0);
    await load();
  });
}

export default async function(){
  const q = getAdminQueryState("adminInvitesFilterForm", "adminInvitesSearch", "adminInvitesLimit");

  q.form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    offset = 0;
    await load();
  });

  document.getElementById("adminInvitesExportBtn")?.addEventListener("click", () => {
    triggerAdminCsvExport("/functions/api/admin/invites_monitor_export_csv", {
      q: q.getSearch()
    });
  });

  await load();
}

import { renderAdminPaging } from "../../js/admin_monitor_helper.js";
import { getJson, postJson } from "../../js/admin_security_helper.js";
import { triggerAdminCsvExport } from "../../js/admin_export_helper.js";

let offset = 0;

function checkedIpBlockIds(){
  return Array.from(document.querySelectorAll('input[data-ip-block-id]:checked'))
    .map(x => String(x.dataset.ipBlockId || "").trim())
    .filter(Boolean);
}

async function load(){
  const info = document.getElementById("ipBlocksInfo");
  const list = document.getElementById("ipBlocksList");
  const limit = Number(document.getElementById("adminIpBlocksLimit")?.value || 20);
  const activeOnly = document.getElementById("adminIpBlocksActiveOnly")?.checked ? "1" : "0";

  const res = await getJson(`/functions/api/admin/ip_blocks_monitor_get?limit=${limit}&offset=${offset}&active_only=${activeOnly}`);

  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load IP blocks.";
    return;
  }

  const rows = res.data?.items || [];
  const paging = res.data?.paging || {};

  if(info) info.textContent = `Loaded ${rows.length} IP block row(s).`;

  if(list){
    list.innerHTML = rows.map(x => `
      <li>
        <label>
          <input type="checkbox" data-ip-block-id="${x.id}">
          <strong>${x.id || "-"}</strong>
          • reason=${x.reason || "-"}
          • expires_at=${x.expires_at || "-"}
          • revoked_at=${x.revoked_at || "-"}
        </label>
      </li>
    `).join("");
  }

  renderAdminPaging("ipBlocksPaging", paging, async () => {
    offset = Math.max(0, Number(paging.prev_offset || 0));
    await load();
  }, async () => {
    offset = Number(paging.next_offset || 0);
    await load();
  });
}

async function bulkUnblock(){
  const ids = checkedIpBlockIds();
  const info = document.getElementById("ipBlocksInfo");

  if(!ids.length){
    if(info) info.textContent = "Select IP block(s) first.";
    return;
  }

  const res = await postJson("/functions/api/admin/ip_blocks_bulk_unblock", {
    ip_block_ids: ids
  });

  if(res.status !== "ok"){
    if(info) info.textContent = res?.data?.message || "Failed to unblock IP blocks.";
    return;
  }

  if(info) info.textContent = `Unblocked ${res.data?.affected || 0} IP block(s).`;
  await load();
}

export default async function(){
  document.getElementById("adminIpBlocksFilterForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    offset = 0;
    await load();
  });

  document.getElementById("adminIpBlocksBulkUnblockBtn")?.addEventListener("click", bulkUnblock);

  document.getElementById("adminIpBlocksExportBtn")?.addEventListener("click", () => {
    const activeOnly = document.getElementById("adminIpBlocksActiveOnly")?.checked ? "1" : "0";
    triggerAdminCsvExport("/functions/api/admin/ip_blocks_monitor_export_csv", {
      active_only: activeOnly
    });
  });

  await load();
}

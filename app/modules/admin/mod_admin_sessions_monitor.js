import { buildAdminUrl, getJson, postJson } from "../../js/admin_security_helper.js";
import { renderAdminPaging } from "../../js/admin_monitor_helper.js";

let offset = 0;

function checkedSessionIds(){
  return Array.from(document.querySelectorAll('input[data-session-id]:checked'))
    .map(x => String(x.dataset.sessionId || "").trim())
    .filter(Boolean);
}

async function load(){
  const info = document.getElementById("sessionsInfo");
  const list = document.getElementById("sessionsList");

  const q = String(document.getElementById("adminSessionsSearch")?.value || "").trim();
  const limit = Number(document.getElementById("adminSessionsLimit")?.value || 20);
  const activeOnly = document.getElementById("adminSessionsActiveOnly")?.checked ? "1" : "0";

  const url = buildAdminUrl("/functions/api/admin/sessions_monitor_get", {
    q,
    limit,
    offset,
    active_only: activeOnly
  });

  const res = await getJson(url);
  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load sessions.";
    return;
  }

  const rows = res.data?.items || [];
  const paging = res.data?.paging || {};

  if(info) info.textContent = `Loaded ${rows.length} session(s).`;

  if(list){
    list.innerHTML = rows.map(x => `
      <li>
        <label>
          <input type="checkbox" data-session-id="${x.id}">
          <strong>${x.display_name || x.email_norm || x.user_id || "-"}</strong>
          • sid=${x.id}
          • expires_at=${x.expires_at || "-"}
          • revoked_at=${x.revoked_at || "-"}
        </label>
      </li>
    `).join("");
  }

  renderAdminPaging("sessionsPaging", paging, async () => {
    offset = Math.max(0, Number(paging.prev_offset || 0));
    await load();
  }, async () => {
    offset = Number(paging.next_offset || 0);
    await load();
  });
}

async function bulkRevoke(){
  const ids = checkedSessionIds();
  const info = document.getElementById("sessionsInfo");

  if(!ids.length){
    if(info) info.textContent = "Select session(s) first.";
    return;
  }

  const res = await postJson("/functions/api/admin/sessions_bulk_revoke", {
    session_ids: ids,
    reason: "admin_bulk_revoke_from_monitor"
  });

  if(res.status !== "ok"){
    if(info) info.textContent = res?.data?.message || "Failed to revoke sessions.";
    return;
  }

  if(info) info.textContent = `Revoked ${res.data?.affected || 0} session(s).`;
  await load();
}

export default async function(){
  document.getElementById("adminSessionsFilterForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    offset = 0;
    await load();
  });

  document.getElementById("adminSessionsBulkRevokeBtn")?.addEventListener("click", bulkRevoke);

  await load();
}

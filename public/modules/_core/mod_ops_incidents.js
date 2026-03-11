import { esc, fmtTs, emptyState, openModal, closeModal, openConfirm, closeConfirm, setMsg, badgeState } from "../../assets/js/orland_ui.js";

export default function(Orland){
  async function apiLoad(params = {}){
    const q = new URLSearchParams();
    if(params.status) q.set("status", params.status);
    if(params.severity) q.set("severity", params.severity);
    if(params.q) q.set("q", params.q);
    return await Orland.api("/api/ops_incidents?" + q.toString());
  }

  async function apiSave(payload){
    return await Orland.api("/api/ops_incidents", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function apiComments(incidentId){
    return await Orland.api("/api/ops_incident_comments?incident_id=" + encodeURIComponent(incidentId));
  }

  async function apiAddComment(payload){
    return await Orland.api("/api/ops_incident_comments", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  function severityBadge(v){
    return badgeState(v, { critical:"red", high:"orange", medium:"amber", low:"slate" }, "slate");
  }

  function statusBadge(v){
    return badgeState(v, { open:"red", acknowledged:"sky", resolved:"emerald", closed:"slate" }, "slate");
  }

  return {
    title:"OPS Incidents",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-7xl">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold ui-title-gradient">OPS Incidents</div>
                <div class="text-slate-500 mt-1">Incident CRUD, triage, dan discussion thread.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnNew" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
                  <i class="fa-solid fa-plus mr-2"></i>New Incident
                </button>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_180px_180px] gap-3">
              <input id="qSearch" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari summary / id / type">
              <select id="qStatus" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                <option value="">All status</option>
                <option value="open">open</option>
                <option value="acknowledged">acknowledged</option>
                <option value="resolved">resolved</option>
                <option value="closed">closed</option>
              </select>
              <select id="qSeverity" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                <option value="">All severity</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-4">
            <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Incident List</div>
              <div id="listBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Detail & Comments</div>
              <div id="detailBox" class="mt-4 text-sm text-slate-500">Pilih incident dari list.</div>
            </div>
          </div>
        </div>

        <div id="modalBackdrop" class="hidden fixed inset-0 z-[100] bg-black/50 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-4 lg:px-5 py-4 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between gap-3">
                <div>
                  <div id="modalTitle" class="text-lg lg:text-xl font-extrabold">Incident</div>
                  <div class="text-xs text-slate-500 mt-1">Create / edit incident</div>
                </div>
                <button id="btnModalClose" class="w-10 h-10 rounded-full border border-slate-200 dark:border-darkBorder"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <div id="modalBody" class="p-4 lg:p-5"></div>
            </div>
          </div>
        </div>

        <div id="confirmBackdrop" class="hidden fixed inset-0 z-[120] bg-black/60 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-5 py-4 border-b border-slate-200 dark:border-darkBorder">
                <div id="confirmTitle" class="text-lg font-extrabold">Confirm Action</div>
                <div id="confirmDesc" class="text-sm text-slate-500 mt-1">Are you sure?</div>
              </div>
              <div class="p-5">
                <div id="confirmMeta" class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 text-sm break-words"></div>
                <div class="mt-5 flex justify-end gap-2">
                  <button id="btnConfirmCancel" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
                  <button id="btnConfirmOk" class="px-4 py-2.5 rounded-2xl bg-red-600 text-white font-black text-sm">Confirm</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let ITEMS = [];
      let ACTIVE = null;
      let confirmAction = null;

      function editorHtml(row = {}){
        const details = row.details_json && typeof row.details_json === "object" ? row.details_json : {};
        return `
          <form id="incidentForm" class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="space-y-4">
              <input type="hidden" name="mode" value="${row.id ? "update" : "create"}">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">ID</label>
                <input name="id" value="${esc(row.id || "")}" ${row.id ? "readonly" : ""} class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 text-sm font-semibold" placeholder="inc_xxx">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">SUMMARY</label>
                <input name="summary" value="${esc(row.summary || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">SEVERITY</label>
                  <select name="severity" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    <option value="low" ${row.severity === "low" ? "selected" : ""}>low</option>
                    <option value="medium" ${row.severity === "medium" || !row.severity ? "selected" : ""}>medium</option>
                    <option value="high" ${row.severity === "high" ? "selected" : ""}>high</option>
                    <option value="critical" ${row.severity === "critical" ? "selected" : ""}>critical</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">TYPE</label>
                  <input name="type" value="${esc(row.type || "general")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">STATUS</label>
                  <select name="status" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    <option value="open" ${row.status === "open" || !row.status ? "selected" : ""}>open</option>
                    <option value="acknowledged" ${row.status === "acknowledged" ? "selected" : ""}>acknowledged</option>
                    <option value="resolved" ${row.status === "resolved" ? "selected" : ""}>resolved</option>
                    <option value="closed" ${row.status === "closed" ? "selected" : ""}>closed</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">OWNER USER ID</label>
                <input name="owner_user_id" value="${esc(row.owner_user_id || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              </div>
              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save</button>
                ${row.id ? `<button type="button" id="btnDeleteIncident" class="px-4 py-2.5 rounded-2xl border border-red-200 text-red-600 font-black text-sm">Delete</button>` : ``}
                <button type="button" id="btnCancelIncident" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">DETAILS JSON</label>
                <textarea id="detailsJson" rows="16" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-mono">${esc(JSON.stringify(details, null, 2))}</textarea>
              </div>
            </div>
          </form>
        `;
      }

      function openEditor(row = {}){
        openModal(host, {
          modalTitle: row.id ? "Edit Incident" : "Create Incident",
          modalBody: editorHtml(row)
        });

        const form = q("incidentForm");
        q("btnCancelIncident").onclick = ()=>closeModal(host);

        q("btnDeleteIncident")?.addEventListener("click", ()=>{
          openConfirm(host, {
            confirmTitle: "Delete Incident",
            confirmDesc: "Incident dan comments akan dihapus.",
            confirmMeta: `<div class="font-black text-red-600">${esc(row.summary || row.id)}</div><div class="text-xs text-slate-500 mt-2">${esc(row.id || "-")}</div>`
          });

          confirmAction = async ()=>{
            setMsg(host, "#msg", "muted", "Deleting...");
            const r = await apiSave({ action:"delete", id: row.id });
            if(r.status !== "ok"){
              setMsg(host, "#msg", "error", "Delete failed: " + (r.data?.message || r.status));
              return;
            }
            closeConfirm(host);
            closeModal(host);
            if(ACTIVE && ACTIVE.id === row.id) ACTIVE = null;
            setMsg(host, "#msg", "success", "Incident deleted.");
            await render();
          };
        });

        form.onsubmit = async (ev)=>{
          ev.preventDefault();

          let details_json = {};
          try{
            details_json = JSON.parse(q("detailsJson").value || "{}");
          }catch{
            setMsg(host, "#msg", "error", "details_json invalid.");
            return;
          }

          const payload = {
            action: form.mode.value,
            id: form.id.value.trim(),
            summary: form.summary.value.trim(),
            severity: form.severity.value,
            type: form.type.value.trim(),
            status: form.status.value,
            owner_user_id: form.owner_user_id.value.trim(),
            details_json
          };

          setMsg(host, "#msg", "muted", "Saving...");
          const r = await apiSave(payload);
          if(r.status !== "ok"){
            setMsg(host, "#msg", "error", "Save failed: " + (r.data?.message || r.status));
            return;
          }

          closeModal(host);
          setMsg(host, "#msg", "success", "Incident saved.");
          await render();
        };
      }

      async function renderDetail(){
        if(!ACTIVE){
          q("detailBox").innerHTML = emptyState("Pilih incident dari list.");
          return;
        }

        q("detailBox").innerHTML = `
          <div class="space-y-4">
            <div>
              <div class="flex gap-2 flex-wrap">
                ${severityBadge(ACTIVE.severity)}
                ${statusBadge(ACTIVE.status)}
              </div>
              <div class="text-lg font-extrabold mt-3">${esc(ACTIVE.summary || "-")}</div>
              <div class="text-xs text-slate-500 mt-2">
                ${esc(ACTIVE.id)} • ${esc(ACTIVE.type || "-")}
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 text-sm space-y-2">
              <div><b>Owner:</b> ${esc(ACTIVE.owner_name || ACTIVE.owner_user_id || "-")}</div>
              <div><b>Updated:</b> ${esc(fmtTs(ACTIVE.updated_at))}</div>
              <div><b>Created:</b> ${esc(fmtTs(ACTIVE.created_at))}</div>
              <div><b>Ack by:</b> ${esc(ACTIVE.ack_name || ACTIVE.acknowledged_by_user_id || "-")}</div>
              <div><b>Closed by:</b> ${esc(ACTIVE.closed_name || ACTIVE.closed_by_user_id || "-")}</div>
            </div>

            <div>
              <div class="text-sm font-black mb-2">Details</div>
              <pre class="text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">${esc(JSON.stringify(ACTIVE.details_json || {}, null, 2))}</pre>
            </div>

            <div>
              <div class="text-sm font-black mb-2">Comments</div>
              <div id="commentList" class="space-y-3"></div>
              <div class="mt-3">
                <textarea id="commentBody" rows="3" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm" placeholder="Tulis komentar incident"></textarea>
                <button id="btnAddComment" class="mt-3 px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Add Comment</button>
              </div>
            </div>
          </div>
        `;

        const commentsRes = await apiComments(ACTIVE.id);
        const list = q("commentList");

        if(commentsRes.status !== "ok"){
          list.innerHTML = `<div class="text-sm text-red-500">Load comments failed: ${esc(commentsRes.status)}</div>`;
        }else{
          const items = Array.isArray(commentsRes.data?.items) ? commentsRes.data.items : [];
          list.innerHTML = items.length ? items.map(x => `
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-xs text-slate-500">${esc(x.author_name || x.author_email || x.author_user_id || "-")} • ${esc(fmtTs(x.created_at))}</div>
              <div class="text-sm mt-2 whitespace-pre-wrap break-words">${esc(x.body || "")}</div>
            </div>
          `).join("") : emptyState("No comments.");
        }

        q("btnAddComment").onclick = async ()=>{
          const body = String(q("commentBody").value || "").trim();
          if(!body){
            setMsg(host, "#msg", "error", "Comment kosong.");
            return;
          }

          setMsg(host, "#msg", "muted", "Saving comment...");
          const r = await apiAddComment({
            incident_id: ACTIVE.id,
            body
          });

          if(r.status !== "ok"){
            setMsg(host, "#msg", "error", "Comment save failed: " + (r.data?.message || r.status));
            return;
          }

          q("commentBody").value = "";
          setMsg(host, "#msg", "success", "Comment saved.");
          await render();
        };
      }

      function renderList(){
        if(!ITEMS.length){
          q("listBox").innerHTML = emptyState("No incidents found.");
          return;
        }

        q("listBox").innerHTML = ITEMS.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 ${ACTIVE && ACTIVE.id === x.id ? 'ring-2 ring-primary/30' : ''}">
            <div class="flex items-start justify-between gap-3">
              <button class="incidentOpen min-w-0 flex-1 text-left" data-id="${esc(x.id)}">
                <div class="flex gap-2 flex-wrap">
                  ${severityBadge(x.severity)}
                  ${statusBadge(x.status)}
                </div>
                <div class="text-base font-extrabold mt-3">${esc(x.summary || "-")}</div>
                <div class="text-xs text-slate-500 mt-2">
                  ${esc(x.id)} • ${esc(x.type || "-")} • updated ${esc(fmtTs(x.updated_at))}
                </div>
              </button>
              <div class="flex gap-2 shrink-0">
                <button class="incidentEdit px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-id="${esc(x.id)}">
                  <i class="fa-solid fa-pen"></i>
                </button>
              </div>
            </div>
          </div>
        `).join("");

        q("listBox").querySelectorAll(".incidentOpen").forEach(btn => {
          btn.onclick = async ()=>{
            ACTIVE = ITEMS.find(x => String(x.id) === String(btn.getAttribute("data-id"))) || null;
            renderList();
            await renderDetail();
          };
        });

        q("listBox").querySelectorAll(".incidentEdit").forEach(btn => {
          btn.onclick = ()=>{
            const row = ITEMS.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(row) openEditor(row);
          };
        });
      }

      async function render(){
        setMsg(host, "#msg", "muted", "Loading incidents...");
        const r = await apiLoad({
          q: q("qSearch").value,
          status: q("qStatus").value,
          severity: q("qSeverity").value
        });

        if(r.status !== "ok"){
          setMsg(host, "#msg", "error", "Load failed: " + r.status);
          q("listBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        if(ACTIVE){
          ACTIVE = ITEMS.find(x => String(x.id) === String(ACTIVE.id)) || null;
        }

        renderList();
        await renderDetail();
        setMsg(host, "#msg", "success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("btnNew").onclick = ()=>openEditor({});
      q("qSearch").oninput = render;
      q("qStatus").onchange = render;
      q("qSeverity").onchange = render;

      q("btnModalClose").onclick = ()=>closeModal(host);
      q("modalBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("modalBackdrop")) closeModal(host);
      });

      q("btnConfirmCancel").onclick = ()=>closeConfirm(host);
      q("btnConfirmOk").onclick = async ()=>{
        if(typeof confirmAction === "function") await confirmAction();
      };
      q("confirmBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("confirmBackdrop")) closeConfirm(host);
      });

      await render();
    }
  };
}

import { esc, fmtTs, fmtNum, setMsg, openModal, closeModal, openConfirm, closeConfirm, badgeState, emptyState } from "../../assets/js/orland_ui.js";

export default function(Orland){
  async function apiLoad(params = {}){
    const q = new URLSearchParams();
    if(params.q) q.set("q", params.q);
    if(params.state) q.set("state", params.state);
    return await Orland.api("/api/ipblocks?" + q.toString());
  }

  async function apiCreate(payload){
    return await Orland.api("/api/ipblocks_create", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function apiRevoke(payload){
    return await Orland.api("/api/ipblocks_revoke", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function apiPurge(){
    return await Orland.api("/api/ipblocks_purge", {
      method:"POST",
      body: JSON.stringify({})
    });
  }

  return {
    title:"IP Blocks",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">IP Blocks</div>
                <div class="text-slate-500 mt-1">Manage banned / blocked IP hashes secara aman.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnPurge" class="px-4 py-3 rounded-2xl border border-amber-200 text-amber-700 font-black text-sm">
                  <i class="fa-solid fa-broom mr-2"></i>Purge
                </button>
                <button id="btnNew" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
                  <i class="fa-solid fa-plus mr-2"></i>New Block
                </button>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-3">
              <input id="qSearch" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari reason / hash / creator">
              <select id="qState" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                <option value="">All state</option>
                <option value="active">active</option>
                <option value="revoked">revoked</option>
                <option value="expired">expired</option>
              </select>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Total</div>
              <div id="kTotal" class="text-2xl font-extrabold mt-2">—</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Active</div>
              <div id="kActive" class="text-2xl font-extrabold mt-2">—</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Revoked</div>
              <div id="kRevoked" class="text-2xl font-extrabold mt-2">—</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Expired</div>
              <div id="kExpired" class="text-2xl font-extrabold mt-2">—</div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Block List</div>
            <div id="listBox" class="mt-4 space-y-3"></div>
          </div>
        </div>

        <div id="modalBackdrop" class="hidden fixed inset-0 z-[100] bg-black/50 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-4 lg:px-5 py-4 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between gap-3">
                <div>
                  <div class="text-lg lg:text-xl font-extrabold">Create IP Block</div>
                  <div class="text-xs text-slate-500 mt-1">IP akan di-hash sebelum disimpan.</div>
                </div>
                <button id="btnModalClose" class="w-10 h-10 rounded-full border border-slate-200 dark:border-darkBorder">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div class="p-4 lg:p-5">
                <form id="blockForm" class="space-y-4">
                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">IP ADDRESS</label>
                    <input id="ip" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="1.2.3.4">
                  </div>

                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">REASON</label>
                    <input id="reason" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="too_many_requests / abuse / manual ban">
                  </div>

                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">TTL MINUTES</label>
                    <input id="ttl" type="number" value="60" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  </div>

                  <div class="flex gap-2 flex-wrap">
                    <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save</button>
                    <button type="button" id="btnCancelModal" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
                  </div>
                </form>
              </div>
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
      let confirmAction = null;

      function renderList(){
        if(!ITEMS.length){
          q("listBox").innerHTML = emptyState("No ip blocks found.");
          return;
        }

        q("listBox").innerHTML = ITEMS.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex gap-2 flex-wrap">
                  ${badgeState(x.state, { active:"red", revoked:"slate", expired:"amber" })}
                </div>
                <div class="text-sm font-extrabold mt-3 break-all">${esc(x.reason || "-")}</div>
                <div class="text-xs text-slate-500 mt-2 break-all">
                  id: ${esc(x.id)} • hash: ${esc(x.ip_hash)}
                </div>
                <div class="text-xs text-slate-500 mt-1">
                  expires: ${esc(fmtTs(x.expires_at))} • revoked: ${esc(fmtTs(x.revoked_at))}
                </div>
                <div class="text-xs text-slate-500 mt-1">
                  by: ${esc(x.created_by_name || x.created_by_email || x.created_by_user_id || "-")}
                </div>
              </div>

              <div class="flex gap-2 shrink-0">
                ${x.state === "active" ? `
                  <button class="btnRevoke px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-black" data-id="${esc(x.id)}">
                    Revoke
                  </button>
                ` : ``}
              </div>
            </div>
          </div>
        `).join("");

        q("listBox").querySelectorAll(".btnRevoke").forEach(btn => {
          btn.onclick = ()=>{
            const row = ITEMS.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(!row) return;

            openConfirm(host, {
              confirmTitle: "Revoke IP Block",
              confirmDesc: "Block aktif akan dicabut.",
              confirmMeta: `<div class="font-black text-red-600">${esc(row.reason || row.id)}</div><div class="text-xs text-slate-500 mt-2 break-all">${esc(row.ip_hash)}</div>`
            });

            confirmAction = async ()=>{
              setMsg(host, "#msg", "muted", "Revoking...");
              const r = await apiRevoke({ id: row.id });
              if(r.status !== "ok"){
                setMsg(host, "#msg", "error", "Revoke failed: " + (r.data?.message || r.status));
                return;
              }
              closeConfirm(host);
              setMsg(host, "#msg", "success", "IP block revoked.");
              await render();
            };
          };
        });
      }

      async function render(){
        setMsg(host, "#msg", "muted", "Loading...");
        const r = await apiLoad({
          q: q("qSearch").value,
          state: q("qState").value
        });

        if(r.status !== "ok"){
          setMsg(host, "#msg", "error", "Load failed: " + r.status);
          q("listBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        const st = r.data?.stats || {};

        q("kTotal").textContent = fmtNum(st.total ?? 0);
        q("kActive").textContent = fmtNum(st.active ?? 0);
        q("kRevoked").textContent = fmtNum(st.revoked ?? 0);
        q("kExpired").textContent = fmtNum(st.expired ?? 0);

        renderList();
        setMsg(host, "#msg", "success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("qSearch").oninput = render;
      q("qState").onchange = render;

      q("btnNew").onclick = ()=>openModal(host);
      q("btnModalClose").onclick = ()=>closeModal(host);
      q("btnCancelModal").onclick = ()=>closeModal(host);
      q("modalBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("modalBackdrop")) closeModal(host);
      });

      q("blockForm").onsubmit = async (ev)=>{
        ev.preventDefault();

        setMsg(host, "#msg", "muted", "Saving...");
        const r = await apiCreate({
          ip: q("ip").value.trim(),
          reason: q("reason").value.trim(),
          ttl_minutes: Number(q("ttl").value || 60)
        });

        if(r.status !== "ok"){
          setMsg(host, "#msg", "error", "Save failed: " + (r.data?.message || r.status));
          return;
        }

        closeModal(host);
        q("blockForm").reset();
        q("ttl").value = "60";
        setMsg(host, "#msg", "success", "IP block saved.");
        await render();
      };

      q("btnPurge").onclick = ()=>{
        openConfirm(host, {
          confirmTitle: "Purge Expired / Revoked",
          confirmDesc: "Data block expired dan revoked akan dihapus permanen.",
          confirmMeta: `<div class="font-black text-amber-700">Cleanup old ip_blocks records</div>`
        });

        confirmAction = async ()=>{
          setMsg(host, "#msg", "muted", "Purging...");
          const r = await apiPurge();
          if(r.status !== "ok"){
            setMsg(host, "#msg", "error", "Purge failed: " + r.status);
            return;
          }
          closeConfirm(host);
          setMsg(host, "#msg", "success", "Purged: " + String(r.data?.purged ?? 0));
          await render();
        };
      };

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

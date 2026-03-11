export default function(Orland){
  async function apiList(){
    return await Orland.api("/api/config/plugins/list");
  }
  async function apiInstall(payload){
    return await Orland.api("/api/config/plugins/install", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }
  async function apiUninstall(payload){
    return await Orland.api("/api/config/plugins/uninstall", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  return {
    title:"Plugins",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-6xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold">Plugins</div>
              <div class="text-slate-500 mt-1">Install / disable plugin entries.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">Reload</button>
              <button id="btnNew" class="px-4 py-3 rounded-2xl bg-primary text-white font-black">Install Plugin</button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>
          <div id="listBox" class="space-y-3"></div>
        </div>

        <div id="modalBackdrop" class="hidden fixed inset-0 z-[100] bg-black/50 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl p-5">
              <div class="text-xl font-extrabold">Install Plugin</div>
              <div class="mt-4 space-y-4">
                <input id="pid" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark" placeholder="plugin_id">
                <input id="pname" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark" placeholder="Plugin Name">
                <input id="pver" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark" placeholder="Version">
                <div class="flex gap-2">
                  <button id="btnSave" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black">Save</button>
                  <button id="btnClose" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function openModal(){ q("modalBackdrop").classList.remove("hidden"); }
      function closeModal(){ q("modalBackdrop").classList.add("hidden"); }

      async function render(){
        setMsg("muted", "Loading...");
        const r = await apiList();
        if(r.status !== "ok"){
          setMsg("error", "Failed: " + r.status);
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        q("listBox").innerHTML = items.length ? items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-extrabold">${esc(x.name || x.id)}</div>
              <div class="text-xs text-slate-500 mt-1">${esc(x.id)} • ${esc(x.version || "-")}</div>
              <div class="text-xs text-slate-500 mt-1">enabled: ${Number(x.enabled || 0) ? "yes" : "no"}</div>
            </div>
            <div>
              ${Number(x.enabled || 0)
                ? `<button class="btnOff px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-black" data-id="${esc(x.id)}">Disable</button>`
                : `<span class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black text-slate-500">disabled</span>`
              }
            </div>
          </div>
        `).join("") : `<div class="text-sm text-slate-500">No plugins.</div>`;

        q("listBox").querySelectorAll(".btnOff").forEach(btn => {
          btn.onclick = async ()=>{
            setMsg("muted", "Updating...");
            const x = await apiUninstall({ id: btn.getAttribute("data-id") });
            if(x.status !== "ok"){
              setMsg("error", "Disable failed: " + x.status);
              return;
            }
            setMsg("success", "Plugin disabled.");
            await render();
          };
        });

        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("btnNew").onclick = openModal;
      q("btnClose").onclick = closeModal;
      q("modalBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("modalBackdrop")) closeModal();
      });

      q("btnSave").onclick = async ()=>{
        setMsg("muted", "Saving...");
        const r = await apiInstall({
          id: q("pid").value.trim(),
          name: q("pname").value.trim(),
          version: q("pver").value.trim()
        });
        if(r.status !== "ok"){
          setMsg("error", "Save failed: " + r.status);
          return;
        }
        closeModal();
        setMsg("success", "Plugin saved.");
        await render();
      };

      await render();
    }
  };
}

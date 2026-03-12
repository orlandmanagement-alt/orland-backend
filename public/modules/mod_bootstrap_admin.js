export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadStatus(){
    return await Orland.api("/api/setup/status");
  }

  async function shutdownBootstrap(){
    return await Orland.api("/api/setup/shutdown", {
      method:"POST",
      body: JSON.stringify({})
    });
  }

  return {
    title:"Bootstrap Admin",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-4xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">Bootstrap Status + Shutdown</div>
            <div class="text-sm text-slate-500 mt-1">Monitor status bootstrap super admin pertama dan kunci endpoint bootstrap secara manual.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="text-xl font-extrabold">Bootstrap Status</div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Reload</button>
                <button id="btnShutdown" class="px-4 py-2.5 rounded-2xl border border-rose-200 text-rose-700 font-black text-sm">Shutdown Bootstrap</button>
              </div>
            </div>
            <div id="statusBox" class="mt-4"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else if(kind === "warning") q("msg").classList.add("text-amber-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderStatus(data){
        q("statusBox").innerHTML = `
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-xs text-slate-500 font-bold">TOTAL USERS</div>
                <div class="mt-2 text-2xl font-extrabold">${esc(data.total_users || 0)}</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-xs text-slate-500 font-bold">BOOTSTRAP LOCKED</div>
                <div class="mt-2 text-2xl font-extrabold">${data.bootstrap_locked ? "YES" : "NO"}</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-xs text-slate-500 font-bold">BOOTSTRAP AVAILABLE</div>
                <div class="mt-2 text-2xl font-extrabold">${data.bootstrap_available ? "YES" : "NO"}</div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 text-sm text-slate-500">
              Setelah bootstrap super admin pertama berhasil, endpoint bootstrap sebaiknya selalu dalam keadaan locked.
            </div>
          </div>
        `;
      }

      async function render(){
        setMsg("muted", "Loading bootstrap status...");
        const r = await loadStatus();
        if(r.status !== "ok"){
          q("statusBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }
        renderStatus(r.data || {});
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("btnShutdown").onclick = async ()=>{
        setMsg("muted", "Shutting down bootstrap...");
        const r = await shutdownBootstrap();
        if(r.status !== "ok"){
          setMsg("error", "Shutdown failed: " + (r.data?.message || r.status));
          return;
        }
        setMsg("success", "Bootstrap locked.");
        await render();
      };

      await render();
    }
  };
}

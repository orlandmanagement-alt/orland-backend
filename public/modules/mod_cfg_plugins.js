export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function apiList(){
    return await Orland.api("/api/config/plugins/list");
  }

  async function apiInstall(id, name){
    return await Orland.api("/api/config/plugins/install", {
      method:"POST",
      body: JSON.stringify({ id, name })
    });
  }

  async function apiUninstall(id){
    return await Orland.api("/api/config/plugins/uninstall", {
      method:"POST",
      body: JSON.stringify({ id })
    });
  }

  const catalog = [
    { id:"blogspot_bundle", name:"Blogspot Bundle", installable:"yes" },
    { id:"visitor_analytics", name:"Visitor Analytics", installable:"yes" }
  ];

  return {
    title:"Plugins",
    async mount(host){
      host.innerHTML = `
        <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
          <div class="text-2xl font-extrabold">Plugins</div>
          <div class="text-slate-500 mt-2">Install/Uninstall plugin (DB + config). Public modules tetap di repo.</div>

          <div class="mt-5">
            <button id="btnReload" class="px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">Reload</button>
          </div>

          <div id="tableWrap" class="mt-6"></div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);

      async function render(){
        const r = await apiList();
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        const byId = new Map(items.map(x => [String(x.id), x]));

        q("tableWrap").innerHTML = `
          <div class="space-y-4">
            ${catalog.map(p => {
              const row = byId.get(p.id);
              const enabled = Number(row?.enabled || 0) === 1;
              return `
                <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                  <div class="grid grid-cols-4 gap-3 items-center">
                    <div>
                      <div class="text-sm font-black">${esc(p.name)}</div>
                      <div class="text-xs text-slate-500 mt-1">${esc(p.id)}</div>
                    </div>
                    <div class="text-sm">${esc(p.installable)}</div>
                    <div class="text-sm font-bold ${enabled ? "text-emerald-600" : "text-slate-500"}">
                      ${enabled ? "enabled" : "not installed"}
                    </div>
                    <div class="flex gap-2 justify-end">
                      ${enabled
                        ? `<button class="btnUninstall px-4 py-2 rounded-xl border border-red-200 text-red-700 font-bold" data-id="${esc(p.id)}">Disable</button>`
                        : `<button class="btnInstall px-4 py-2 rounded-xl bg-primary text-white font-bold" data-id="${esc(p.id)}" data-name="${esc(p.name)}">Install</button>`
                      }
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `;

        q("tableWrap").querySelectorAll(".btnInstall").forEach(btn=>{
          btn.onclick = async ()=>{
            const id = btn.getAttribute("data-id");
            const name = btn.getAttribute("data-name");
            const res = await apiInstall(id, name);
            if(res.status !== "ok"){
              alert("Install failed: " + res.status);
              return;
            }
            await render();
          };
        });

        q("tableWrap").querySelectorAll(".btnUninstall").forEach(btn=>{
          btn.onclick = async ()=>{
            const id = btn.getAttribute("data-id");
            const res = await apiUninstall(id);
            if(res.status !== "ok"){
              alert("Disable failed: " + res.status);
              return;
            }
            await render();
          };
        });
      }

      q("btnReload").onclick = render;
      await render();
    }
  };
}

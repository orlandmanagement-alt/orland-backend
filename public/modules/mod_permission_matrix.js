export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadMatrix(){
    return await Orland.api("/api/access/matrix");
  }

  return {
    title:"Permission Matrix",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">Permission Matrix</div>
                <div class="text-sm text-slate-500 mt-1">Matriks role terhadap menu untuk audit dan review akses.</div>
              </div>
              <button id="btnReload" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Reload</button>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div id="summaryBox" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4 overflow-auto">
            <div id="matrixBox"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderSummary(data){
        const roles = Array.isArray(data.roles) ? data.roles : [];
        const menus = Array.isArray(data.menus) ? data.menus : [];
        const summary = Array.isArray(data.summary) ? data.summary : [];

        q("summaryBox").innerHTML = `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4"><div class="text-xs text-slate-500">Roles</div><div class="text-2xl font-extrabold mt-2">${roles.length}</div></div>
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4"><div class="text-xs text-slate-500">Menus</div><div class="text-2xl font-extrabold mt-2">${menus.length}</div></div>
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4"><div class="text-xs text-slate-500">Max Coverage</div><div class="text-2xl font-extrabold mt-2">${summary.reduce((m, x)=>Math.max(m, Number(x.menu_count || 0)), 0)}</div></div>
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4"><div class="text-xs text-slate-500">Min Coverage</div><div class="text-2xl font-extrabold mt-2">${summary.length ? summary.reduce((m, x)=>Math.min(m, Number(x.menu_count || 0)), 999999) : 0}</div></div>
        `;
      }

      function renderMatrix(data){
        const roles = Array.isArray(data.roles) ? data.roles : [];
        const menus = Array.isArray(data.menus) ? data.menus : [];
        const matrix = data.matrix || {};

        if(!roles.length || !menus.length){
          q("matrixBox").innerHTML = `<div class="text-sm text-slate-500">No matrix data.</div>`;
          return;
        }

        q("matrixBox").innerHTML = `
          <table class="min-w-full text-sm border-collapse">
            <thead>
              <tr>
                <th class="sticky left-0 bg-white dark:bg-darkLighter z-10 text-left p-3 border-b border-slate-200 dark:border-darkBorder">Menu</th>
                ${roles.map(r => `<th class="text-center p-3 border-b border-slate-200 dark:border-darkBorder whitespace-nowrap">${esc(r.name)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${menus.map(m => `
                <tr>
                  <td class="sticky left-0 bg-white dark:bg-darkLighter z-10 p-3 border-b border-slate-200 dark:border-darkBorder">
                    <div class="font-semibold">${esc(m.label || m.code)}</div>
                    <div class="text-xs text-slate-500 mt-1">${esc(m.path || "-")}</div>
                  </td>
                  ${roles.map(r => `
                    <td class="text-center p-3 border-b border-slate-200 dark:border-darkBorder">
                      ${(matrix[r.id] && matrix[r.id][m.id])
                        ? `<span class="inline-block px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">YES</span>`
                        : `<span class="inline-block px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-black">NO</span>`
                      }
                    </td>
                  `).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }

      async function render(){
        setMsg("muted", "Loading permission matrix...");
        const r = await loadMatrix();
        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + (r.data?.message || r.status));
          q("matrixBox").innerHTML = `<div class="text-sm text-red-500">Load failed.</div>`;
          return;
        }
        renderSummary(r.data || {});
        renderMatrix(r.data || {});
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      await render();
    }
  };
}

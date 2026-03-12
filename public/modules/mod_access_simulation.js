export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadRoles(){
    return await Orland.api("/api/roles");
  }

  async function simulate(roleName){
    return await Orland.api("/api/access/simulate?role_name=" + encodeURIComponent(roleName));
  }

  return {
    title:"Access Simulation",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">Access Simulation</div>
            <div class="text-sm text-slate-500 mt-1">Preview menu coverage untuk role tertentu tanpa login ulang.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <select id="roleSelect" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold"></select>
              <button id="btnRun" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Run Simulation</button>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Summary</div>
              <div id="summaryBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Menus</div>
              <div id="menusBox" class="mt-4 space-y-3"></div>
            </div>
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
        const g = data.grouped_counts || {};
        q("summaryBox").innerHTML = `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="text-sm font-black">${esc(data.role?.name || "-")}</div>
            <div class="text-xs text-slate-500 mt-1">${esc(data.role?.id || "-")}</div>
            <div class="text-2xl font-extrabold mt-3">${esc(data.total_menus || 0)} menus</div>
          </div>
          ${Object.keys(g).sort().map(k => `
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 flex items-center justify-between">
              <div class="text-sm font-semibold">${esc(k)}</div>
              <div class="text-lg font-extrabold">${esc(g[k])}</div>
            </div>
          `).join("")}
        `;
      }

      function renderMenus(data){
        const items = Array.isArray(data.menus) ? data.menus : [];
        q("menusBox").innerHTML = items.length ? items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="font-black text-sm">${esc(x.label || x.code || x.id)}</div>
            <div class="text-xs text-slate-500 mt-1">${esc(x.path || "-")}</div>
            <div class="mt-2 flex gap-2 flex-wrap">
              <span class="px-2 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black">${esc(x.group_key || "settings")}</span>
              <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.code || "-")}</span>
            </div>
          </div>
        `).join("") : `<div class="text-sm text-slate-500">No menus for selected role.</div>`;
      }

      async function renderRoles(){
        const r = await loadRoles();
        if(r.status !== "ok"){
          setMsg("error", "Failed to load roles.");
          return;
        }
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        q("roleSelect").innerHTML = items.map(x => `
          <option value="${esc(x.name)}">${esc(x.name)} (${esc(x.id)})</option>
        `).join("");
      }

      async function run(){
        const roleName = String(q("roleSelect").value || "").trim();
        if(!roleName){
          setMsg("error", "Select role first.");
          return;
        }

        setMsg("muted", "Running simulation...");
        const r = await simulate(roleName);
        if(r.status !== "ok"){
          setMsg("error", "Simulation failed: " + (r.data?.message || r.status));
          return;
        }

        renderSummary(r.data || {});
        renderMenus(r.data || {});
        setMsg("success", "Simulation complete.");
      }

      q("btnRun").onclick = run;
      await renderRoles();
      await run();
    }
  };
}

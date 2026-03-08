(function(){
  const Orland = window.Orland;

  Orland.registerModule("rbac_manager", {
    async mount(host, ctx){
      host.innerHTML = `
        <div class="space-y-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">RBAC Manager</h2>
            <div class="text-xs text-slate-500">Assign menu ke role (role_menus)</div>
          </div>

          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="flex flex-wrap items-center gap-3">
              <select id="roleSelect" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs"></select>
              <button id="btnReload" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Reload</button>
              <button id="btnSave" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Save</button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" id="checks"></div>

          <details class="text-[11px] text-slate-500">
            <summary>Debug</summary>
            <pre id="dbg" class="whitespace-pre-wrap"></pre>
          </details>
        </div>
      `;

      const dbg = document.getElementById("dbg");
      let roles=[], menus=[], role_menus=[];

      async function load(){
        const r = await ctx.api("/api/rbac/bundle");
        if(dbg) dbg.textContent = JSON.stringify(r,null,2);
        if(r.status!=="ok"){ ctx.toast("Failed: "+r.status, "error"); return; }
        roles = r.data.roles||[];
        menus = r.data.menus||[];
        role_menus = r.data.role_menus||[];

        const sel = document.getElementById("roleSelect");
        sel.innerHTML = roles.map(x=>`<option value="${ctx.esc(x.id)}">${ctx.esc(x.name)}</option>`).join("");
        renderChecks();
      }

      function renderChecks(){
        const rid = document.getElementById("roleSelect").value;
        const set = new Set(role_menus.filter(x=>x.role_id===rid).map(x=>x.menu_id));
        const box = document.getElementById("checks");
        box.innerHTML = menus.map(m=>`
          <label class="bg-white dark:bg-darkLighter p-3 rounded-xl border border-slate-200 dark:border-darkBorder flex gap-3 items-start cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
            <input type="checkbox" class="mt-1" data-mid="${ctx.esc(m.id)}" ${set.has(m.id)?"checked":""}>
            <div class="min-w-0">
              <div class="font-bold text-slate-900 dark:text-white text-sm">${m.icon?`<i class="${ctx.esc(m.icon)} mr-2"></i>`:""}${ctx.esc(m.label)}</div>
              <div class="text-[10px] text-slate-500 truncate">${ctx.esc(m.path)} • <code>${ctx.esc(m.code)}</code></div>
            </div>
          </label>
        `).join("");
      }

      document.getElementById("roleSelect").onchange = renderChecks;
      document.getElementById("btnReload").onclick = load;

      document.getElementById("btnSave").onclick = async ()=>{
        const rid = document.getElementById("roleSelect").value;
        const menu_ids = Array.from(document.querySelectorAll('#checks input[type="checkbox"]'))
          .filter(x=>x.checked).map(x=>x.getAttribute("data-mid"));
        const rr = await ctx.api("/api/role-menus/set", { method:"POST", body: JSON.stringify({ role_id: rid, menu_ids }) });
        if(dbg) dbg.textContent = JSON.stringify(rr,null,2);
        ctx.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") load();
      };

      await load();
    }
  });
})();

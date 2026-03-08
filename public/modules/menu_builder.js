(function(){
  const Orland = window.Orland;

  Orland.registerModule("menu_builder", {
    async mount(host, ctx){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">Menu Builder</h2>
              <div class="text-xs text-slate-500">CRUD menus table + icon FontAwesome</div>
            </div>
            <div class="flex gap-2">
              <button id="btnSeed" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Seed</button>
              <button id="btnReload" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Reload</button>
            </div>
          </div>

          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input id="id" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs" placeholder="id (optional)">
              <input id="code" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs" placeholder="code">
              <input id="label" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs" placeholder="label">
              <input id="path" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs" placeholder="/path">
              <input id="parent_id" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs" placeholder="parent_id (optional)">
              <input id="sort_order" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs" placeholder="sort_order" value="50">
              <input id="icon" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs md:col-span-2" placeholder="fa-solid fa-gauge-high">
              <button id="btnUpsert" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Upsert</button>
            </div>
            <div class="text-[10px] text-slate-500 mt-2">Tip: gunakan icon FontAwesome seperti <code>fa-solid fa-users</code></div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs whitespace-nowrap">
                <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                  <tr>
                    <th class="px-4 py-3 font-semibold">Menu</th>
                    <th class="px-4 py-3 font-semibold">Path</th>
                    <th class="px-4 py-3 font-semibold">Parent</th>
                    <th class="px-4 py-3 font-semibold">Sort</th>
                    <th class="px-4 py-3 font-semibold">Icon</th>
                    <th class="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody id="rows" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
              </table>
            </div>
          </div>

          <details class="text-[11px] text-slate-500">
            <summary>Debug</summary>
            <pre id="dbg" class="whitespace-pre-wrap"></pre>
          </details>
        </div>
      `;

      const dbg = document.getElementById("dbg");

      async function load(){
        const r = await ctx.api("/api/menus");
        if(dbg) dbg.textContent = JSON.stringify(r,null,2);
        const body = document.getElementById("rows");
        if(r.status!=="ok"){
          body.innerHTML = `<tr><td class="px-4 py-3 text-danger" colspan="6">${ctx.esc(r.status)}</td></tr>`;
          return;
        }
        body.innerHTML = (r.data.menus||[]).map(m=>`
          <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
            <td class="px-4 py-3">
              <div class="font-bold text-slate-900 dark:text-white">${ctx.esc(m.label)}</div>
              <div class="text-[10px] text-slate-500">${ctx.esc(m.code)} • <code>${ctx.esc(m.id)}</code></div>
            </td>
            <td class="px-4 py-3 text-slate-500">${ctx.esc(m.path)}</td>
            <td class="px-4 py-3 text-slate-500"><code>${ctx.esc(m.parent_id||"")}</code></td>
            <td class="px-4 py-3">${ctx.esc(String(m.sort_order||""))}</td>
            <td class="px-4 py-3">${m.icon?`<i class="${ctx.esc(m.icon)}"></i> <span class="text-[10px] text-slate-500">${ctx.esc(m.icon)}</span>`:"-"}</td>
            <td class="px-4 py-3 text-right">
              <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-xs btnFill" data-json='${ctx.esc(JSON.stringify(m))}'>Fill</button>
              <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-xs btnDel" data-id="${ctx.esc(m.id)}">Delete</button>
            </td>
          </tr>
        `).join("");

        document.querySelectorAll(".btnFill").forEach(b=>{
          b.onclick = ()=>{
            const obj = JSON.parse(b.getAttribute("data-json")||"{}");
            ["id","code","label","path","parent_id","sort_order","icon"].forEach(k=>{
              const el = document.getElementById(k);
              if(!el) return;
              el.value = obj[k] ?? "";
            });
            if(document.getElementById("sort_order")) document.getElementById("sort_order").value = String(obj.sort_order ?? 50);
            ctx.toast("Form filled", "info");
          };
        });

        document.querySelectorAll(".btnDel").forEach(b=>{
          b.onclick = async ()=>{
            const id = b.getAttribute("data-id");
            if(!confirm("Delete menu?")) return;
            const rr = await ctx.api("/api/menus?id="+encodeURIComponent(id), { method:"DELETE" });
            if(dbg) dbg.textContent = JSON.stringify(rr,null,2);
            ctx.toast(rr.status, rr.status==="ok"?"success":"error");
            if(rr.status==="ok") load();
          };
        });
      }

      document.getElementById("btnReload").onclick = load;
      document.getElementById("btnSeed").onclick = async ()=>{
        const rr = await ctx.api("/api/menus/seed", { method:"POST", body:"{}" });
        if(dbg) dbg.textContent = JSON.stringify(rr,null,2);
        ctx.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") load();
      };

      document.getElementById("btnUpsert").onclick = async ()=>{
        const payload = {
          id: (document.getElementById("id").value||"").trim() || null,
          code: (document.getElementById("code").value||"").trim(),
          label: (document.getElementById("label").value||"").trim(),
          path: (document.getElementById("path").value||"").trim(),
          parent_id: (document.getElementById("parent_id").value||"").trim() || null,
          sort_order: Number((document.getElementById("sort_order").value||"50")),
          icon: (document.getElementById("icon").value||"").trim() || null
        };
        const rr = await ctx.api("/api/menus", { method:"POST", body: JSON.stringify(payload) });
        if(dbg) dbg.textContent = JSON.stringify(rr,null,2);
        ctx.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") load();
      };

      await load();
    }
  });
})();

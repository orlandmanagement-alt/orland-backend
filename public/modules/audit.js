(function(){
  const Orland = window.Orland;

  Orland.registerModule("audit", {
    async mount(host, ctx){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">Audit Logs</h2>
              <div class="text-xs text-slate-500">/api/audit (searchable)</div>
            </div>
            <div class="flex gap-2">
              <input id="q" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs w-64" placeholder="q: action / route / actor...">
              <button id="btnReload" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Reload</button>
            </div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs whitespace-nowrap">
                <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                  <tr>
                    <th class="px-4 py-3 font-semibold">Action</th>
                    <th class="px-4 py-3 font-semibold">Route</th>
                    <th class="px-4 py-3 font-semibold">HTTP</th>
                    <th class="px-4 py-3 font-semibold">Actor</th>
                    <th class="px-4 py-3 font-semibold">At</th>
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
        const q = (document.getElementById("q").value||"").trim();
        const r = await ctx.api("/api/audit?limit=120&q="+encodeURIComponent(q));
        if(dbg) dbg.textContent = JSON.stringify(r,null,2);
        const body = document.getElementById("rows");
        if(r.status!=="ok"){
          body.innerHTML = `<tr><td class="px-4 py-3 text-danger" colspan="5">${ctx.esc(r.status)}</td></tr>`;
          return;
        }
        body.innerHTML = (r.data.rows||[]).map(x=>`
          <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
            <td class="px-4 py-3"><code>${ctx.esc(x.action||"")}</code></td>
            <td class="px-4 py-3 text-slate-500">${ctx.esc(x.route||x.target_id||"")}</td>
            <td class="px-4 py-3">${ctx.esc(String(x.http_status||""))}</td>
            <td class="px-4 py-3 text-slate-500"><code>${ctx.esc(x.actor_user_id||"")}</code></td>
            <td class="px-4 py-3 text-slate-500">${ctx.esc(String(x.created_at||""))}</td>
          </tr>
        `).join("");
      }

      document.getElementById("btnReload").onclick = load;
      document.getElementById("q").addEventListener("keydown",(e)=>{ if(e.key==="Enter") load(); });

      await load();
    }
  });
})();

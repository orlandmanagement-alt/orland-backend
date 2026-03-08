/**
 * Audit Logs module (plug & play)
 * Route: /audit
 * API: GET /api/audit/list?limit=100&q=...
 */
(function(){
  const M = window.Orland?.Modules;
  const API = window.Orland?.API;
  if(!M || !API) return;

  function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

  M.register("/audit", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Audit Logs</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Jejak aktivitas HTTP & aksi admin.</p>
          </div>
          <button id="btnReloadAudit" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">
            <i class="fa-solid fa-rotate-right mr-2"></i>Reload
          </button>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <div class="flex-1">
              <div class="text-[11px] text-slate-500 mb-1">Search (action / route / actor)</div>
              <input id="auditQ" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm"
                placeholder="contoh: /api/login atau user_id atau http.request">
            </div>
            <div>
              <div class="text-[11px] text-slate-500 mb-1">Limit</div>
              <select id="auditLimit" class="w-36 px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm">
                <option value="50">50</option>
                <option value="100" selected>100</option>
                <option value="200">200</option>
              </select>
            </div>
            <div class="pt-5 md:pt-0">
              <button id="btnSearchAudit" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:opacity-90 dark:bg-slate-200 dark:text-slate-900">
                <i class="fa-solid fa-magnifying-glass mr-2"></i>Search
              </button>
            </div>
          </div>

          <div id="auditTable" class="mt-4 text-xs text-slate-500">Loading…</div>
        </div>
      </div>
    `;

    async function load(){
      const q = String(document.getElementById("auditQ").value||"").trim();
      const limit = Number(document.getElementById("auditLimit").value||100);
      const url = "/api/audit/list?limit=" + encodeURIComponent(limit) + (q ? ("&q="+encodeURIComponent(q)) : "");
      const r = await API.req(url);

      const el = document.getElementById("auditTable");
      if(r.status !== "ok"){
        el.innerHTML = `<div class="text-slate-500">Failed: ${esc(r.status)}</div>`;
        return;
      }

      const rows = r.data.rows || [];
      if(!rows.length){
        el.innerHTML = `<div class="text-slate-500">No logs.</div>`;
        return;
      }

      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
              <tr>
                <th class="py-2 pr-3">At</th>
                <th class="py-2 pr-3">Action</th>
                <th class="py-2 pr-3">Route</th>
                <th class="py-2 pr-3">HTTP</th>
                <th class="py-2 pr-3">Actor</th>
                <th class="py-2">Meta</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
              ${rows.map(x=>{
                const meta = x.meta_json ? String(x.meta_json).slice(0,180) : "";
                return `
                  <tr>
                    <td class="py-2 pr-3 text-slate-500">${esc(String(x.created_at||""))}</td>
                    <td class="py-2 pr-3 font-bold"><code>${esc(x.action||"")}</code></td>
                    <td class="py-2 pr-3 text-slate-500">${esc(x.route||x.target_id||"")}</td>
                    <td class="py-2 pr-3">${esc(String(x.http_status||""))}</td>
                    <td class="py-2 pr-3 text-slate-500"><code>${esc(x.actor_user_id||"")}</code></td>
                    <td class="py-2 text-slate-500">${esc(meta)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    document.getElementById("btnReloadAudit").addEventListener("click", load);
    document.getElementById("btnSearchAudit").addEventListener("click", load);
    document.getElementById("auditQ").addEventListener("keydown", (e)=>{ if(e.key==="Enter") load(); });

    await load();
  });

})();

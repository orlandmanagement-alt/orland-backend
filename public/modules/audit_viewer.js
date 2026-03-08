(function(){
  const M = window.Orland?.Modules;
  const API = window.Orland?.API;
  if(!M || !API) return;

  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  function fmtTs(sec){
    if(!sec) return "-";
    try{
      const d = new Date(Number(sec)*1000);
      return d.toISOString().replace("T"," ").slice(0,19);
    }catch{ return String(sec); }
  }

  M.register("/audit", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-5">
        <div class="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Audit Logs</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Request id, latency, ip/ua hash, route, status.</p>
          </div>
          <div class="flex items-center gap-2">
            <input id="q" class="px-3 py-2 rounded-lg bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder text-sm w-64"
              placeholder="search action / route / req_id / ip_hash ...">
            <select id="limit" class="px-3 py-2 rounded-lg bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder text-sm">
              <option>50</option><option selected>80</option><option>120</option><option>200</option>
            </select>
            <button id="btnLoad" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">
              <i class="fa-solid fa-rotate mr-2"></i>Load
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                <tr>
                  <th class="px-4 py-3 font-semibold">Time</th>
                  <th class="px-4 py-3 font-semibold">Status</th>
                  <th class="px-4 py-3 font-semibold">Latency</th>
                  <th class="px-4 py-3 font-semibold">Route</th>
                  <th class="px-4 py-3 font-semibold">Actor</th>
                  <th class="px-4 py-3 font-semibold">Req ID</th>
                  <th class="px-4 py-3 font-semibold">IP Hash</th>
                </tr>
              </thead>
              <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
            </table>
          </div>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="dbg" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    const tb = document.getElementById("tb");
    const dbg = document.getElementById("dbg");
    const q = document.getElementById("q");
    const limit = document.getElementById("limit");

    async function load(){
      const url = "/api/audit?limit=" + encodeURIComponent(limit.value || "80")
        + (q.value.trim() ? "&q=" + encodeURIComponent(q.value.trim()) : "");
      const r = await API.req(url);
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok"){
        tb.innerHTML = `<tr><td class="px-4 py-4 text-slate-500" colspan="7">Failed: ${esc(r.status)}</td></tr>`;
        return;
      }
      const rows = r.data.rows || [];
      tb.innerHTML = rows.map(x=>{
        const st = Number(x.http_status||0);
        const stCls = st>=500 ? "text-red-500" : st>=400 ? "text-orange-500" : "text-emerald-500";
        return `
          <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
            <td class="px-4 py-3 text-slate-500">${esc(fmtTs(x.created_at))}</td>
            <td class="px-4 py-3 font-bold ${stCls}">${esc(String(st||""))}</td>
            <td class="px-4 py-3 text-slate-500">${esc(x.lat_ms!=null ? (x.lat_ms+"ms") : "-")}</td>
            <td class="px-4 py-3">
              <div class="font-semibold text-slate-900 dark:text-white">${esc(x.action||"")}</div>
              <div class="text-[10px] text-slate-500">${esc(x.method||"")} ${esc(x.path||x.route||"")}</div>
            </td>
            <td class="px-4 py-3 text-slate-500"><code>${esc(x.actor_user_id||"-")}</code></td>
            <td class="px-4 py-3 text-slate-500"><code>${esc(x.req_id||"-")}</code></td>
            <td class="px-4 py-3 text-slate-500"><code>${esc(x.ip_hash||"-")}</code></td>
          </tr>
        `;
      }).join("") || `<tr><td class="px-4 py-4 text-slate-500" colspan="7">No logs.</td></tr>`;
    }

    document.getElementById("btnLoad").onclick = load;
    q.addEventListener("keydown",(e)=>{ if(e.key==="Enter") load(); });

    await load();
  });
})();

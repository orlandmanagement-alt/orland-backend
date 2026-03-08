(function(){
  const Orland = window.Orland;

  Orland.registerModule("security", {
    async mount(host, ctx){
      host.innerHTML = `
        <div class="space-y-6">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Security</h2>
            <div class="text-xs text-slate-500">metrics + ip activity (existing endpoints)</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            ${kpi("Active IP Blocks","—")}
            ${kpi("Password Fail (sum)","—")}
            ${kpi("Rate Limited (sum)","—")}
            ${kpi("Session Anomaly (sum)","—")}
          </div>

          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-bold">Top IP Activity (password_fail)</div>
              <div class="flex gap-2 items-center">
                <select id="minutes" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs">
                  <option value="60">60m</option>
                  <option value="240" selected>240m</option>
                  <option value="1440">24h</option>
                </select>
                <button id="btnTop" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Load</button>
              </div>
            </div>
            <div class="mt-3 overflow-x-auto">
              <table class="w-full text-left text-xs whitespace-nowrap">
                <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                  <tr><th class="py-2">ip_hash</th><th class="py-2">total</th><th class="py-2">last_seen</th></tr>
                </thead>
                <tbody id="topRows"></tbody>
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

      async function loadMetrics(){
        const r = await ctx.api("/api/security/metrics?days=7");
        if(dbg) dbg.textContent = JSON.stringify(r,null,2);
        if(r.status!=="ok"){ ctx.toast("metrics: "+r.status,"error"); return; }
        const series = r.data.series||[];
        const sum = (k)=>series.reduce((a,x)=>a+Number(x[k]||0),0);
        setKpi(0, r.data.active_ip_blocks);
        setKpi(1, sum("password_fail"));
        setKpi(2, sum("rate_limited"));
        setKpi(3, sum("session_anomaly"));
      }

      async function loadTop(){
        const minutes = document.getElementById("minutes").value || "240";
        const r = await ctx.api("/api/security/ip-activity?kind=password_fail&minutes="+encodeURIComponent(minutes)+"&limit=20");
        if(dbg) dbg.textContent = JSON.stringify(r,null,2);
        const body = document.getElementById("topRows");
        if(r.status!=="ok"){ body.innerHTML = `<tr><td class="py-2 text-danger" colspan="3">${ctx.esc(r.status)}</td></tr>`; return; }
        body.innerHTML = (r.data.rows||[]).map(x=>`
          <tr class="border-b border-slate-100 dark:border-darkBorder">
            <td class="py-2"><code>${ctx.esc(x.ip_hash||"")}</code></td>
            <td class="py-2 font-bold">${ctx.esc(String(x.total||0))}</td>
            <td class="py-2 text-slate-500">${ctx.esc(String(x.last_seen_at||""))}</td>
          </tr>
        `).join("");
      }

      document.getElementById("btnTop").onclick = loadTop;

      await loadMetrics();
      await loadTop();
    }
  });

  function kpi(label, value){
    return `
      <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
        <p class="text-xs font-medium text-slate-500">${label}</p>
        <div class="kpiValue text-2xl font-bold text-slate-900 dark:text-white mt-1">${value}</div>
      </div>
    `;
  }
  function setKpi(i,v){
    const els = document.querySelectorAll(".kpiValue");
    if(els[i]) els[i].textContent = String(v ?? "—");
  }
})();

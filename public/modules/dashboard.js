(function(){
  const Orland = window.Orland;

  Orland.registerModule("dashboard", {
    async mount(host, ctx){
      host.innerHTML = `
        <div class="space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Enterprise Overview</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="kpis">
            ${kpi("Users","—","success")}
            ${kpi("Roles","—","info")}
            ${kpi("Menus","—","info")}
            ${kpi("Active IP Blocks","—","danger")}
          </div>

          <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm h-80 flex flex-col">
            <h3 class="text-sm font-bold mb-4">Traffic Rate</h3>
            <div class="flex-1 relative w-full h-full"><canvas id="mainChart"></canvas></div>
            <div class="text-[10px] text-slate-500 mt-2">Chart dummy (nanti bisa diganti hourly_metrics)</div>
          </div>

          <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
            <h3 class="text-sm font-bold mb-3">Ops Status (live)</h3>
            <pre id="opsRaw" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
          </div>
        </div>
      `;

      const ops = await ctx.api("/api/ops/status");
      const raw = document.getElementById("opsRaw");
      if(raw) raw.textContent = JSON.stringify(ops, null, 2);

      if(ops.status==="ok"){
        setKpi(0, ops.data.users);
        setKpi(1, ops.data.roles);
        setKpi(2, ops.data.menus);
        setKpi(3, ops.data.ip_blocks_active);
      }

      // chart
      try{
        if(!window.Chart) return;
        const el = document.getElementById("mainChart");
        if(!el) return;
        const old = Chart.getChart("mainChart");
        if(old) old.destroy();
        new Chart(el.getContext("2d"), {
          type: "line",
          data: {
            labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
            datasets: [{
              label: "Traffic",
              data: [120,190,150,250,220,310,280],
              borderWidth: 2,
              fill: true,
              tension: 0.4
            }]
          },
          options: { maintainAspectRatio:false, responsive:true, plugins:{ legend:{ display:false } } }
        });
      }catch{}
    }
  });

  function kpi(label, value, badge){
    const badgeColor = badge==="danger"?"bg-danger/10 text-danger":"bg-success/10 text-success";
    return `
      <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
        <div class="flex justify-between items-start mb-2">
          <p class="text-xs font-medium text-slate-500">${label}</p>
          <span class="${badgeColor} px-2 py-0.5 rounded text-[10px] font-bold">LIVE</span>
        </div>
        <h3 class="kpiValue text-2xl font-bold text-slate-900 dark:text-white mb-1">${value}</h3>
      </div>
    `;
  }
  function setKpi(idx, v){
    const els = document.querySelectorAll(".kpiValue");
    if(els[idx]) els[idx].textContent = String(v ?? "—");
  }
})();

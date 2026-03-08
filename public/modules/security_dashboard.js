export default function SecurityDashboardModule(ctx){
  const { api, toast, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Security Dashboard</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">KPI + hourly trend + top IP activity</p>
      </div>
      <div class="flex items-center gap-2">
        <select id="days" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          <option value="1">1 day</option>
          <option value="3">3 days</option>
          <option value="7" selected>7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
        </select>
        <button id="btnReload" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Reload</button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
      <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
        <div class="text-xs text-slate-500">Active IP Blocks</div>
        <div id="kpiBlocks" class="text-2xl font-bold mt-2 text-slate-900 dark:text-white">—</div>
        <div class="text-[11px] text-slate-500 mt-2">From /api/security/metrics</div>
      </div>
      <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
        <div class="text-xs text-slate-500">Password Fail</div>
        <div id="kpiPwFail" class="text-2xl font-bold mt-2 text-slate-900 dark:text-white">—</div>
        <div class="text-[11px] text-slate-500 mt-2">Sum(last days)</div>
      </div>
      <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
        <div class="text-xs text-slate-500">Rate Limited</div>
        <div id="kpiRate" class="text-2xl font-bold mt-2 text-slate-900 dark:text-white">—</div>
        <div class="text-[11px] text-slate-500 mt-2">Sum(last days)</div>
      </div>
      <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
        <div class="text-xs text-slate-500">Session Anomaly</div>
        <div id="kpiAnom" class="text-2xl font-bold mt-2 text-slate-900 dark:text-white">—</div>
        <div class="text-[11px] text-slate-500 mt-2">Sum(last days)</div>
      </div>
    </div>

    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm mt-5">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-bold text-slate-900 dark:text-white">Hourly Trend</div>
          <div class="text-xs text-slate-500 mt-1">password_fail / rate_limited / session_anomaly</div>
        </div>
      </div>
      <div class="mt-4 relative w-full" style="height:320px">
        <canvas id="secChart"></canvas>
      </div>
      <div id="chartHint" class="text-[11px] text-slate-500 mt-3"></div>
    </div>

    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm mt-5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-sm font-bold text-slate-900 dark:text-white">Top IP Activity</div>
          <div class="text-xs text-slate-500 mt-1">Top offenders (pw_fail window)</div>
        </div>
        <button id="btnTop" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">
          Load Top
        </button>
      </div>
      <div id="topTable" class="mt-4"></div>
    </div>

    <details class="mt-5">
      <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
      <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
    </details>
  `;

  let chart = null;

  function sumSeries(series, key){
    return (series||[]).reduce((a,x)=>a + Number(x?.[key]||0), 0);
  }

  function destroyChart(){
    try{ if(chart) chart.destroy(); }catch{}
    chart = null;
  }

  function isDark(){
    return document.documentElement.classList.contains("dark");
  }

  function fmtHour(epochSec){
    try{
      const d = new Date(Number(epochSec||0)*1000);
      // YYYY-MM-DD HH:00
      return d.toISOString().slice(0,13)+":00";
    }catch{
      return String(epochSec||"");
    }
  }

  async function loadKpi(){
    const days = el.querySelector("#days").value || "7";
    const r = await api("/api/security/metrics?days="+encodeURIComponent(days));
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);

    if(r.status !== "ok"){ toast("metrics failed: "+r.status,"error"); return null; }

    const series = r.data?.series || [];
    el.querySelector("#kpiBlocks").textContent = String(r.data?.active_ip_blocks ?? "0");
    el.querySelector("#kpiPwFail").textContent = String(sumSeries(series,"password_fail"));
    el.querySelector("#kpiRate").textContent = String(sumSeries(series,"rate_limited"));
    el.querySelector("#kpiAnom").textContent = String(sumSeries(series,"session_anomaly"));
    return true;
  }

  async function loadChart(){
    const days = el.querySelector("#days").value || "7";
    const r = await api("/api/security/hourly?days="+encodeURIComponent(days));
    // append debug but keep readable
    const out = el.querySelector("#out").textContent || "";
    el.querySelector("#out").textContent = out + "\n\n" + JSON.stringify({ hourly: r }, null, 2);

    if(r.status !== "ok"){
      el.querySelector("#chartHint").textContent = "Hourly failed: " + r.status;
      destroyChart();
      return;
    }

    const rows = r.data?.rows || [];
    const labels = rows.map(x=>fmtHour(x.hour_epoch));
    const pw = rows.map(x=>Number(x.password_fail||0));
    const rate = rows.map(x=>Number(x.rate_limited||0));
    const anom = rows.map(x=>Number(x.session_anomaly||0));

    if(!window.Chart){
      el.querySelector("#chartHint").textContent = "Chart.js tidak ter-load. Rows=" + rows.length;
      return;
    }

    const ctx2 = el.querySelector("#secChart").getContext("2d");
    destroyChart();

    const gridColor = isDark() ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const textColor = isDark() ? "#94a3b8" : "#64748b";

    chart = new Chart(ctx2, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label:"password_fail", data: pw, borderWidth:2, tension:0.35, fill:false },
          { label:"rate_limited", data: rate, borderWidth:2, tension:0.35, fill:false },
          { label:"session_anomaly", data: anom, borderWidth:2, tension:0.35, fill:false },
        ]
      },
      options: {
        maintainAspectRatio:false,
        responsive:true,
        plugins:{ legend:{ position:"top", labels:{ color:textColor, boxWidth:10, boxHeight:10 } } },
        scales:{
          y:{ beginAtZero:true, grid:{ color:gridColor }, ticks:{ color:textColor, font:{ size:10 } }, border:{ display:false } },
          x:{ grid:{ display:false }, ticks:{ color:textColor, font:{ size:10 }, maxRotation:0, autoSkip:true }, border:{ display:false } },
        }
      }
    });

    el.querySelector("#chartHint").textContent = "Rows loaded: " + rows.length;
  }

  async function loadTop(){
    // window 240 minutes
    const r = await api("/api/security/ip-activity?kind=password_fail&minutes=240&limit=30");
    const out = el.querySelector("#out").textContent || "";
    el.querySelector("#out").textContent = out + "\n\n" + JSON.stringify({ top: r }, null, 2);

    if(r.status !== "ok"){
      el.querySelector("#topTable").innerHTML = `<div class="text-xs text-slate-500">Top failed: ${r.status}</div>`;
      return;
    }

    const rows = r.data?.rows || [];
    el.querySelector("#topTable").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">IP Hash</th>
              <th class="px-4 py-3 font-semibold">Total</th>
              <th class="px-4 py-3 font-semibold">Last Seen</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(x=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3"><code>${x.ip_hash||""}</code></td>
                <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">${x.total||0}</td>
                <td class="px-4 py-3 text-slate-500">${x.last_seen_at||""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function reloadAll(){
    await loadKpi();
    await loadChart();
    await loadTop();
  }

  return {
    mount(host){
      setBreadcrumb("/ security");
      host.innerHTML = "";
      host.appendChild(el);

      el.querySelector("#btnReload").onclick = reloadAll;
      el.querySelector("#btnTop").onclick = loadTop;
      el.querySelector("#days").onchange = reloadAll;

      reloadAll();
    },
    unmount(){
      destroyChart();
    }
  };
}

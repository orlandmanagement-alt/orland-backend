export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  const nfmt = (n)=> {
    try{ return new Intl.NumberFormat("id-ID").format(Number(n||0)); }
    catch{ return String(n||0); }
  };

  async function loadOps(){
    const r = await Orland.api("/api/ops/status");
    if(r.status==="ok") return r.data || {};
    return {};
  }

  async function loadVisitors(){
    const r = await Orland.api("/api/analytics/visitors?minutes=60");
    if(r.status==="ok") return r.data || {};
    return { enabled:false, error:r };
  }

  function drawMiniChart(canvas, series){
    if(!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width * ratio));
    const height = Math.max(220, Math.floor(rect.height * ratio));

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,width,height);

    const pad = 20 * ratio;
    const innerW = width - pad*2;
    const innerH = height - pad*2;

    // bg
    ctx.fillStyle = "rgba(148,163,184,0.04)";
    ctx.fillRect(0,0,width,height);

    if(!series || !series.length){
      ctx.fillStyle = "#94a3b8";
      ctx.font = `${12*ratio}px sans-serif`;
      ctx.fillText("No visitor data", pad, pad + 14*ratio);
      return;
    }

    const vals = series.map(x=>Number(x.requests||0));
    const max = Math.max(1, ...vals);

    // grid
    ctx.strokeStyle = "rgba(148,163,184,0.18)";
    ctx.lineWidth = 1;
    for(let i=0;i<4;i++){
      const y = pad + (innerH/3)*i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + innerW, y);
      ctx.stroke();
    }

    // area
    ctx.beginPath();
    vals.forEach((v,i)=>{
      const x = pad + (i / (vals.length-1 || 1)) * innerW;
      const y = pad + innerH - (v/max) * innerH;
      if(i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });
    ctx.lineTo(pad + innerW, pad + innerH);
    ctx.lineTo(pad, pad + innerH);
    ctx.closePath();
    ctx.fillStyle = "rgba(59,130,246,0.16)";
    ctx.fill();

    // line
    ctx.beginPath();
    vals.forEach((v,i)=>{
      const x = pad + (i / (vals.length-1 || 1)) * innerW;
      const y = pad + innerH - (v/max) * innerH;
      if(i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2 * ratio;
    ctx.stroke();

    // point
    const last = vals[vals.length-1] || 0;
    const lx = pad + innerW;
    const ly = pad + innerH - (last/max) * innerH;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5*ratio, 0, Math.PI*2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();

    // labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${11*ratio}px sans-serif`;
    ctx.fillText("60m ago", pad, height - 5*ratio);
    ctx.fillText("now", width - 30*ratio, height - 5*ratio);
    ctx.fillText(String(max), 4*ratio, pad + 10*ratio);
  }

  return {
    title: "Dashboard",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div>
            <div class="text-xl font-extrabold text-slate-900 dark:text-white">Dashboard</div>
            <div class="text-sm text-slate-500">Enterprise overview + realtime visitor analytics.</div>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-darkLighter p-4 rounded-2xl border border-slate-200 dark:border-darkBorder">
              <div class="text-[11px] text-slate-500">Total Admin</div>
              <div id="kpiAdmin" class="text-2xl font-black mt-1">—</div>
            </div>
            <div class="bg-white dark:bg-darkLighter p-4 rounded-2xl border border-slate-200 dark:border-darkBorder">
              <div class="text-[11px] text-slate-500">Total Client</div>
              <div id="kpiClient" class="text-2xl font-black mt-1">—</div>
            </div>
            <div class="bg-white dark:bg-darkLighter p-4 rounded-2xl border border-slate-200 dark:border-darkBorder">
              <div class="text-[11px] text-slate-500">Total Talent</div>
              <div id="kpiTalent" class="text-2xl font-black mt-1">—</div>
            </div>
            <div class="bg-white dark:bg-darkLighter p-4 rounded-2xl border border-slate-200 dark:border-darkBorder">
              <div class="text-[11px] text-slate-500">Total Projects</div>
              <div id="kpiProjects" class="text-2xl font-black mt-1">—</div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div class="xl:col-span-2 bg-white dark:bg-darkLighter p-4 rounded-2xl border border-slate-200 dark:border-darkBorder">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-sm font-extrabold">Visitors LIVE</div>
                  <div class="text-[11px] text-slate-500">Cloudflare Analytics • 60 menit terakhir</div>
                </div>
                <div id="visBadge" class="text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-slate-500">—</div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div class="p-3 rounded-xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20">
                  <div class="text-[11px] text-slate-500">Last minute requests</div>
                  <div id="visLastReq" class="text-xl font-black mt-1">—</div>
                </div>
                <div class="p-3 rounded-xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20">
                  <div class="text-[11px] text-slate-500">Total requests (60m)</div>
                  <div id="visTotReq" class="text-xl font-black mt-1">—</div>
                </div>
                <div class="p-3 rounded-xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20">
                  <div class="text-[11px] text-slate-500">Total uniques (60m)</div>
                  <div id="visTotUniq" class="text-xl font-black mt-1">—</div>
                </div>
              </div>

              <div class="mt-4 rounded-2xl border border-slate-200 dark:border-darkBorder overflow-hidden bg-slate-50 dark:bg-black/20">
                <div class="px-3 py-2 text-[11px] text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                  Requests per minute
                </div>
                <div class="p-3">
                  <canvas id="visChart" style="width:100%;height:240px;display:block"></canvas>
                </div>
              </div>

              <div id="visHint" class="text-[11px] text-slate-500 mt-4"></div>
            </div>

            <div class="bg-white dark:bg-darkLighter p-4 rounded-2xl border border-slate-200 dark:border-darkBorder">
              <div class="text-sm font-extrabold">Quick Actions</div>
              <div class="text-[11px] text-slate-500 mt-1">Akses cepat modul penting</div>

              <div class="grid gap-2 mt-4">
                <button class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left" id="goUsers">
                  <div class="text-xs font-black"><i class="fa-solid fa-users-gear me-2"></i>User Manager</div>
                  <div class="text-[11px] text-slate-500">Admin / Client / Talent</div>
                </button>
                <button class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left" id="goMenus">
                  <div class="text-xs font-black"><i class="fa-solid fa-sitemap me-2"></i>Menu Builder</div>
                  <div class="text-[11px] text-slate-500">Sidebar & role menus</div>
                </button>
                <button class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left" id="goAnalytics">
                  <div class="text-xs font-black"><i class="fa-solid fa-chart-line me-2"></i>Analytics Settings</div>
                  <div class="text-[11px] text-slate-500">Enable / zone / token</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      host.querySelector("#goUsers")?.addEventListener("click", ()=>Orland.navigate("/users/admin"));
      host.querySelector("#goMenus")?.addEventListener("click", ()=>Orland.navigate("/menus"));
      host.querySelector("#goAnalytics")?.addEventListener("click", ()=>Orland.navigate("/config/analytics"));

      try{
        const ops = await loadOps();
        host.querySelector("#kpiAdmin").textContent = nfmt(ops.users_admin ?? ops.admins ?? ops.total_admin ?? 0);
        host.querySelector("#kpiClient").textContent = nfmt(ops.users_client ?? ops.clients ?? ops.total_client ?? 0);
        host.querySelector("#kpiTalent").textContent = nfmt(ops.users_talent ?? ops.talents ?? ops.total_talent ?? 0);
        host.querySelector("#kpiProjects").textContent = nfmt(ops.projects ?? ops.total_projects ?? 0);
      }catch{}

      async function renderVisitors(){
        const badge = host.querySelector("#visBadge");
        const hint = host.querySelector("#visHint");
        const chart = host.querySelector("#visChart");

        const v = await loadVisitors();

        if(!v || !v.enabled){
          badge.textContent = "Analytics OFF";
          badge.className = "text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-slate-500";
          host.querySelector("#visLastReq").textContent = "—";
          host.querySelector("#visTotReq").textContent = "—";
          host.querySelector("#visTotUniq").textContent = "—";
          hint.innerHTML = `Aktifkan di <b>Configuration → Analytics Settings</b>.`;
          drawMiniChart(chart, []);
          return;
        }

        badge.textContent = "LIVE";
        badge.className = "text-[11px] px-2 py-1 rounded-lg border border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-black/20 dark:border-emerald-700 dark:text-emerald-400";

        host.querySelector("#visLastReq").textContent = nfmt(v.last?.requests ?? 0);
        host.querySelector("#visTotReq").textContent = nfmt(v.total_requests ?? 0);
        host.querySelector("#visTotUniq").textContent = nfmt(v.total_uniques ?? 0);
        hint.textContent = `Window: ${v.minutes || 60} menit • source: Cloudflare Analytics`;
        drawMiniChart(chart, v.series || []);
      }

      await renderVisitors();
      const timer = setInterval(renderVisitors, 60000);
      host.__orlandTimer = timer;
    }
  };
}

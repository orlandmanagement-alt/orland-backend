export default function(Orland){
  function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
  function nfmt(n){ try{ return new Intl.NumberFormat().format(Number(n||0)); }catch{ return String(n||0); } }

  async function loadOps(){
    // ops/status kamu mungkin sudah ada. Kalau tidak ada, fallback.
    const r = await Orland.api("/api/ops/status");
    if(r.status==="ok") return r.data;
    return null;
  }

  async function loadVisitors(){
    const r = await Orland.api("/api/analytics/visitors?minutes=60");
    if(r.status==="ok") return r.data;
    return { enabled:false };
  }

  return {
    title: "Dashboard",
    async mount(host){
      host.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="text-[11px] text-slate-500">Total Admin</div>
            <div id="kpiAdmin" class="text-2xl font-black mt-1">—</div>
          </div>
          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="text-[11px] text-slate-500">Total Client</div>
            <div id="kpiClient" class="text-2xl font-black mt-1">—</div>
          </div>
          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="text-[11px] text-slate-500">Total Talent</div>
            <div id="kpiTalent" class="text-2xl font-black mt-1">—</div>
          </div>
          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="text-[11px] text-slate-500">Total Projects</div>
            <div id="kpiProjects" class="text-2xl font-black mt-1">—</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div class="lg:col-span-2 bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-black">Visitors (Cloudflare Analytics)</div>
                <div class="text-[11px] text-slate-500 mt-1">Realtime (1m groups), refresh 60s</div>
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

            <div id="visHint" class="text-[11px] text-slate-500 mt-4"></div>
          </div>

          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="text-sm font-black">Quick Actions</div>
            <div class="text-[11px] text-slate-500 mt-1">Akses cepat modul penting</div>
            <div class="grid gap-2 mt-4">
              <button class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left" id="goUsers">
                <div class="text-xs font-black"><i class="fa-solid fa-users-gear me-2"></i>User Manager</div>
                <div class="text-[11px] text-slate-500">Admin / Client / Talent</div>
              </button>
              <button class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left" id="goMenus">
                <div class="text-xs font-black"><i class="fa-solid fa-sitemap me-2"></i>Menu Builder</div>
                <div class="text-[11px] text-slate-500">Atur sidebar & role menus</div>
              </button>
              <button class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left" id="goOps">
                <div class="text-xs font-black"><i class="fa-solid fa-triangle-exclamation me-2"></i>Incidents</div>
                <div class="text-[11px] text-slate-500">Alert & incident tracking</div>
              </button>
            </div>
          </div>
        </div>
      `;

      host.querySelector("#goUsers")?.addEventListener("click", ()=>Orland.navigate("/users/admin"));
      host.querySelector("#goMenus")?.addEventListener("click", ()=>Orland.navigate("/menus"));
      host.querySelector("#goOps")?.addEventListener("click", ()=>Orland.navigate("/ops/incidents"));

      // KPI totals
      const ops = await loadOps();
      if(ops){
        // sesuaikan dengan response ops/status kamu
        host.querySelector("#kpiAdmin").textContent = nfmt(ops.users_admin ?? ops.admins ?? ops.users ?? 0);
        host.querySelector("#kpiClient").textContent = nfmt(ops.users_client ?? ops.clients ?? 0);
        host.querySelector("#kpiTalent").textContent = nfmt(ops.users_talent ?? ops.talents ?? 0);
        host.querySelector("#kpiProjects").textContent = nfmt(ops.projects ?? 0);
      }else{
        host.querySelector("#kpiAdmin").textContent = "—";
        host.querySelector("#kpiClient").textContent = "—";
        host.querySelector("#kpiTalent").textContent = "—";
        host.querySelector("#kpiProjects").textContent = "—";
      }

      async function renderVisitors(){
        const v = await loadVisitors();
        const badge = host.querySelector("#visBadge");
        const hint = host.querySelector("#visHint");

        if(!v || !v.enabled){
          badge.textContent = "Analytics OFF";
          badge.className = "text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-slate-500";
          host.querySelector("#visLastReq").textContent = "—";
          host.querySelector("#visTotReq").textContent = "—";
          host.querySelector("#visTotUniq").textContent = "—";
          hint.innerHTML = `Aktifkan di <b>Settings</b> (super_admin): set <code>cf_analytics_enabled=1</code>, isi <code>zone_tag</code> + <code>token</code>.`;
          return;
        }

        badge.textContent = "LIVE";
        badge.className = "text-[11px] px-2 py-1 rounded-lg border border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-black/20 dark:border-emerald-700 dark:text-emerald-400";

        host.querySelector("#visLastReq").textContent = nfmt(v.last?.requests ?? 0);
        host.querySelector("#visTotReq").textContent = nfmt(v.total_requests ?? 0);
        host.querySelector("#visTotUniq").textContent = nfmt(v.total_uniques ?? 0);
        hint.textContent = `Window: ${v.minutes || 60} menit • source: Cloudflare Analytics`;
      }

      await renderVisitors();
      // refresh 60s
      const t = setInterval(renderVisitors, 60000);
      // optional: cleanup when leaving module (not implemented in core)
      host.__orland_timer = t;
    }
  };
}

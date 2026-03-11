export default function(Orland){
  const fmt = (n)=>{
    try{ return new Intl.NumberFormat("id-ID").format(Number(n||0)); }
    catch{ return String(n||0); }
  };

  async function loadIncidents(){
    const r = await Orland.api("/api/incidents/list?limit=200");
    if(r.status === "ok") return Array.isArray(r.data?.items) ? r.data.items : [];
    return [];
  }

  function card(title, value, hint=""){
    return `
      <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
        <div class="text-[11px] text-slate-500 font-bold">${title}</div>
        <div class="text-2xl font-black mt-1">${value}</div>
        ${hint ? `<div class="text-[11px] text-slate-500 mt-1">${hint}</div>` : ``}
      </div>
    `;
  }

  return {
    title:"Operations",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xl font-extrabold text-slate-900 dark:text-white">Operations</div>
              <div class="text-sm text-slate-500">Ringkasan incident operations dan akses cepat modul ops.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnReload" class="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                Reload
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div id="kOpenWrap">${card("Open Incidents","—")}</div>
            <div id="kAckWrap">${card("Acknowledged","—")}</div>
            <div id="kClosedWrap">${card("Closed","—")}</div>
            <div id="kTotalWrap">${card("Total Incidents","—")}</div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div class="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-sm font-extrabold">Recent Incidents</div>
              <div id="recentBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-sm font-extrabold">Quick Actions</div>
              <div class="text-[11px] text-slate-500 mt-1">Navigasi cepat ke modul ops.</div>

              <div class="grid gap-2 mt-4">
                <button id="goIncidents" class="px-3 py-3 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left">
                  <div class="text-xs font-black"><i class="fa-solid fa-triangle-exclamation me-2"></i>Incident Manager</div>
                  <div class="text-[11px] text-slate-500 mt-1">Create, acknowledge, close, comment</div>
                </button>

                <button id="goOncall" class="px-3 py-3 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left">
                  <div class="text-xs font-black"><i class="fa-solid fa-user-clock me-2"></i>Oncall</div>
                  <div class="text-[11px] text-slate-500 mt-1">Open oncall rotation / groups</div>
                </button>

                <button id="goSecurity" class="px-3 py-3 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left">
                  <div class="text-xs font-black"><i class="fa-solid fa-shield-halved me-2"></i>Security Dashboard</div>
                  <div class="text-[11px] text-slate-500 mt-1">Review auth and alert metrics</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const recentBox = host.querySelector("#recentBox");

      function sevBadge(sev){
        const s = String(sev||"").toLowerCase();
        if(s==="critical") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">critical</span>`;
        if(s==="high") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">high</span>`;
        if(s==="medium") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-100 text-sky-700 border border-sky-200">medium</span>`;
        return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">low</span>`;
      }

      function statusBadge(st){
        const s = String(st||"").toLowerCase();
        if(s==="closed") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">closed</span>`;
        if(s==="acknowledged") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200">acknowledged</span>`;
        return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">open</span>`;
      }

      function fmtTs(n){
        try{
          return new Intl.DateTimeFormat("id-ID", { dateStyle:"medium", timeStyle:"short" }).format(new Date(Number(n||0)*1000));
        }catch{
          return String(n||"");
        }
      }

      async function render(){
        const items = await loadIncidents();

        const open = items.filter(x => String(x.status||"") === "open").length;
        const ack = items.filter(x => String(x.status||"") === "acknowledged").length;
        const closed = items.filter(x => String(x.status||"") === "closed").length;
        const total = items.length;

        host.querySelector("#kOpenWrap").innerHTML = card("Open Incidents", fmt(open), "Perlu tindakan");
        host.querySelector("#kAckWrap").innerHTML = card("Acknowledged", fmt(ack), "Sedang ditangani");
        host.querySelector("#kClosedWrap").innerHTML = card("Closed", fmt(closed), "Sudah selesai");
        host.querySelector("#kTotalWrap").innerHTML = card("Total Incidents", fmt(total), "Semua status");

        const recent = items.slice(0, 8);
        if(!recent.length){
          recentBox.innerHTML = `<div class="text-xs text-slate-500">No incidents yet.</div>`;
          return;
        }

        recentBox.innerHTML = recent.map(it => `
          <button data-id="${it.id}" class="goIncident w-full text-left rounded-xl border border-slate-200 dark:border-darkBorder p-3 hover:bg-slate-50 dark:hover:bg-white/5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">${String(it.summary || "Untitled incident")}</div>
                <div class="text-[11px] text-slate-500 mt-1">
                  ${String(it.type || "-")} • ${fmtTs(it.updated_at || it.created_at)}
                </div>
              </div>
              <div class="flex gap-2 shrink-0">
                ${sevBadge(it.severity)}
                ${statusBadge(it.status)}
              </div>
            </div>
          </button>
        `).join("");

        recentBox.querySelectorAll(".goIncident").forEach(btn=>{
          btn.onclick = ()=>Orland.navigate("/ops/incidents");
        });
      }

      host.querySelector("#btnReload").onclick = render;
      host.querySelector("#goIncidents").onclick = ()=>Orland.navigate("/ops/incidents");
      host.querySelector("#goOncall").onclick = ()=>Orland.navigate("/ops/oncall");
      host.querySelector("#goSecurity").onclick = ()=>Orland.navigate("/security");

      await render();
    }
  };
}

export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  async function stats(){ return await Orland.api("/api/stats"); }

  return {
    title: "Dashboard",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <div class="text-lg font-black">Enterprise Overview</div>
            <div class="text-xs text-slate-500 mt-1">KPI ringkas (Admin/Client/Talent/Projects + online).</div>
            <div class="mt-4" id="kpiBox">Loading…</div>
          </div>
        </div>
      `;

      const box = host.querySelector("#kpiBox");
      const r = await stats();
      if(r.status!=="ok"){
        box.innerHTML = `<div class="text-sm text-red-500">Failed: ${esc(r.status)}</div><pre class="text-[11px] mt-2 whitespace-pre-wrap">${esc(JSON.stringify(r.data||{},null,2))}</pre>`;
        return;
      }
      const s = r.data || {};
      box.innerHTML = `
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          ${card("Admins", s.total_admin)}
          ${card("Clients", s.total_client)}
          ${card("Talents", s.total_talent)}
          ${card("Projects", s.total_projects)}
          ${card("Online (15m)", s.online_total)}
        </div>
        <div class="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
          ${cardSmall("Online Admin", s.online_admin)}
          ${cardSmall("Online Client", s.online_client)}
          ${cardSmall("Online Talent", s.online_talent)}
        </div>
        <div class="mt-4 text-[11px] text-slate-500">
          Visitor bisa diambil dari <code>ip_activity</code> / <code>audit_logs</code> jika kamu mau tracking view yang lebih detail.
        </div>
      `;

      function card(label, val){
        return `
          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="text-[11px] text-slate-500">${esc(label)}</div>
            <div class="text-2xl font-black">${esc(val||0)}</div>
          </div>
        `;
      }
      function cardSmall(label, val){
        return `
          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="text-[11px] text-slate-500">${esc(label)}</div>
            <div class="text-xl font-black">${esc(val||0)}</div>
          </div>
        `;
      }
    }
  };
}

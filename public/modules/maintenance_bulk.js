(function(){
  const M = window.Orland?.Modules, API = window.Orland?.API;
  if(!M || !API) return;

  M.register("/maintenance/bulk", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Bulk Maintenance</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Super Admin only. Be careful.</p>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 space-y-3 text-xs">
          <label class="flex items-center gap-2"><input id="a1" type="checkbox"> clear_audit</label>
          <label class="flex items-center gap-2"><input id="a2" type="checkbox"> clear_hourly_metrics</label>
          <label class="flex items-center gap-2"><input id="a3" type="checkbox"> clear_ip_activity</label>
          <label class="flex items-center gap-2"><input id="a4" type="checkbox"> revoke_all_sessions</label>
          <label class="flex items-center gap-2"><input id="a5" type="checkbox"> clear_incidents</label>

          <button id="btnRun" class="px-3 py-2 rounded-lg bg-danger text-white text-xs font-bold w-full"><i class="fa-solid fa-triangle-exclamation mr-2"></i>RUN</button>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="dbg" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    const dbg = document.getElementById("dbg");

    document.getElementById("btnRun").onclick = async ()=>{
      if(!confirm("Confirm bulk maintenance?")) return;
      const actions=[];
      if(document.getElementById("a1").checked) actions.push("clear_audit");
      if(document.getElementById("a2").checked) actions.push("clear_hourly_metrics");
      if(document.getElementById("a3").checked) actions.push("clear_ip_activity");
      if(document.getElementById("a4").checked) actions.push("revoke_all_sessions");
      if(document.getElementById("a5").checked) actions.push("clear_incidents");

      const r = await API.req("/api/maintenance/bulk",{method:"POST", body: JSON.stringify({ actions })});
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
    };
  });
})();

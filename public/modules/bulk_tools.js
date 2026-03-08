(function(){
  const M = window.Orland?.Modules;
  const API = window.Orland?.API;
  if(!M || !API) return;

  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  async function run(action, payload={}){
    payload.action = action;
    payload.confirm = "I_UNDERSTAND";
    return await API.req("/api/admin/bulk", { method:"POST", body: JSON.stringify(payload) });
  }

  M.register("/config/bulk", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Bulk Tools</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Super Admin only. Clear/purge safely.</p>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 space-y-3">
          <div class="text-xs text-slate-500">
            Semua action butuh konfirmasi internal: <code>I_UNDERSTAND</code> (sudah otomatis).
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button id="btnSess" class="px-3 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:opacity-90 dark:bg-white dark:text-slate-900">
              Purge Sessions (expired/revoked)
            </button>
            <button id="btnIp" class="px-3 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:opacity-90 dark:bg-white dark:text-slate-900">
              Purge IP Blocks (expired/revoked)
            </button>
            <button id="btnAudit" class="px-3 py-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90">
              Clear Audit Logs (older_than_days)
            </button>
            <button id="btnHourly" class="px-3 py-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90">
              Clear Hourly Metrics (older_than_days)
            </button>
            <button id="btnIpAct" class="px-3 py-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90">
              Clear IP Activity (older_than_days)
            </button>
          </div>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="dbg" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    const dbg = document.getElementById("dbg");

    document.getElementById("btnSess").onclick = async ()=>{
      if(!confirm("Purge sessions expired/revoked?")) return;
      const r = await run("purge_sessions");
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
    };

    document.getElementById("btnIp").onclick = async ()=>{
      if(!confirm("Purge expired/revoked ip_blocks?")) return;
      const r = await run("purge_ip_blocks");
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
    };

    document.getElementById("btnAudit").onclick = async ()=>{
      const days = Number(prompt("older_than_days:", "90")||"90");
      if(!confirm("Clear audit logs older than "+days+" days?")) return;
      const r = await run("clear_audit",{ older_than_days: days });
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
    };

    document.getElementById("btnHourly").onclick = async ()=>{
      const days = Number(prompt("older_than_days:", "30")||"30");
      if(!confirm("Clear hourly_metrics older than "+days+" days?")) return;
      const r = await run("clear_hourly_metrics",{ older_than_days: days });
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
    };

    document.getElementById("btnIpAct").onclick = async ()=>{
      const days = Number(prompt("older_than_days:", "30")||"30");
      if(!confirm("Clear ip_activity older than "+days+" days?")) return;
      const r = await run("clear_ip_activity",{ older_than_days: days });
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
    };
  });
})();

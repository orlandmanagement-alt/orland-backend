export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm font-bold">Bulk Tools (Super Admin)</div>
        <div class="text-xs text-slate-500">Hati-hati: operasi hapus data</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select id="action" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="clear_audit">clear_audit</option>
            <option value="clear_sessions_revoked">clear_sessions_revoked</option>
            <option value="clear_incidents_closed">clear_incidents_closed</option>
            <option value="clear_metrics_hourly">clear_metrics_hourly</option>
            <option value="clear_metrics_daily">clear_metrics_daily</option>
          </select>
          <input id="days" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="before_days (0 = all)" value="0">
          <button id="btnRun" class="text-xs px-3 py-2 rounded-lg bg-danger text-white">RUN</button>
        </div>

        <div class="text-xs text-slate-500">Tip: isi before_days = 30 untuk hapus data lebih lama dari 30 hari.</div>

        <details open>
          <summary class="text-xs text-slate-500">Result</summary>
          <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
        </details>
      </div>
    </div>
  `;

  const el=(id)=>document.getElementById(id);
  el("btnRun").onclick = async ()=>{
    if(!confirm("CONFIRM: bulk operation?")) return;
    const payload = { action: el("action").value, before_days: Number(el("days").value||0) };
    const r = await api("/api/admin/bulk", { method:"POST", body: JSON.stringify(payload) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };
}

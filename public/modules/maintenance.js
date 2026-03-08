export default function MaintenanceModule(ctx){
  const { api, toast, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Maintenance</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Housekeeping (super_admin only)</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm p-4">
        <div class="text-xs text-slate-500">Users</div>
        <div id="kUsers" class="text-2xl font-bold mt-2 text-slate-900 dark:text-white">—</div>
      </div>
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm p-4">
        <div class="text-xs text-slate-500">Active Sessions</div>
        <div id="kSessions" class="text-2xl font-bold mt-2 text-slate-900 dark:text-white">—</div>
      </div>
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm p-4">
        <div class="text-xs text-slate-500">Audit Rows</div>
        <div id="kAudit" class="text-2xl font-bold mt-2 text-slate-900 dark:text-white">—</div>
      </div>
    </div>

    <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm p-4 mt-5">
      <div class="text-sm font-bold text-slate-900 dark:text-white">Danger Zone</div>
      <div class="text-xs text-slate-500 mt-1">Gunakan hanya untuk housekeeping. Tidak drop table.</div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div class="p-3 rounded-lg border border-slate-200 dark:border-darkBorder">
          <div class="font-bold text-xs">Purge Audit Logs</div>
          <div class="text-[11px] text-slate-500 mt-1">Delete audit_logs older than N days</div>
          <div class="flex items-center gap-2 mt-3">
            <input id="daysAudit" value="30" class="w-20 px-2 py-2 rounded border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
            <button id="btnPurgeAudit" class="px-3 py-2 rounded bg-danger text-white text-xs font-bold hover:opacity-90">Run</button>
          </div>
        </div>

        <div class="p-3 rounded-lg border border-slate-200 dark:border-darkBorder">
          <div class="font-bold text-xs">Purge Sessions</div>
          <div class="text-[11px] text-slate-500 mt-1">Delete expired/revoked sessions</div>
          <div class="flex items-center gap-2 mt-3">
            <button id="btnPurgeSessions" class="px-3 py-2 rounded bg-danger text-white text-xs font-bold hover:opacity-90">Run</button>
          </div>
        </div>

        <div class="p-3 rounded-lg border border-slate-200 dark:border-darkBorder">
          <div class="font-bold text-xs">Purge IP Activity</div>
          <div class="text-[11px] text-slate-500 mt-1">Delete ip_activity older than N days</div>
          <div class="flex items-center gap-2 mt-3">
            <input id="daysIp" value="30" class="w-20 px-2 py-2 rounded border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
            <button id="btnPurgeIp" class="px-3 py-2 rounded bg-danger text-white text-xs font-bold hover:opacity-90">Run</button>
          </div>
        </div>
      </div>
    </div>

    <details class="mt-5">
      <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
      <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
    </details>
  `;

  async function load(){
    const r = await api("/api/ops/maintenance");
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);

    if(r.status !== "ok"){
      toast("maintenance status failed: "+r.status,"error");
      return;
    }

    el.querySelector("#kUsers").textContent = String(r.data?.users ?? "0");
    el.querySelector("#kSessions").textContent = String(r.data?.sessions_active ?? "0");
    el.querySelector("#kAudit").textContent = String(r.data?.audit_rows ?? "0");
  }

  async function post(action, extra={}){
    const rr = await api("/api/ops/maintenance", { method:"POST", body: JSON.stringify({ action, ...extra }) });
    const out = el.querySelector("#out").textContent || "";
    el.querySelector("#out").textContent = out + "\n\n" + JSON.stringify(rr,null,2);
    toast(rr.status, rr.status==="ok"?"success":"error");
    if(rr.status==="ok") load();
  }

  return {
    mount(host){
      setBreadcrumb("/ ops / maintenance");
      host.innerHTML="";
      host.appendChild(el);

      el.querySelector("#btnReload").onclick = load;

      el.querySelector("#btnPurgeAudit").onclick = ()=>{
        if(!confirm("Purge audit logs?")) return;
        const days = Number(el.querySelector("#daysAudit").value||"30");
        post("purge_audit",{ days });
      };
      el.querySelector("#btnPurgeSessions").onclick = ()=>{
        if(!confirm("Purge sessions?")) return;
        post("purge_sessions",{});
      };
      el.querySelector("#btnPurgeIp").onclick = ()=>{
        if(!confirm("Purge ip_activity?")) return;
        const days = Number(el.querySelector("#daysIp").value||"30");
        post("purge_ip_activity",{ days });
      };

      load();
    }
  };
}

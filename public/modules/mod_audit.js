export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
  <div class="space-y-4">
    <div class="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div class="text-sm font-bold">Audit Logs</div>
        <div class="text-xs text-slate-500">Filter + export CSV</div>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button id="btnReload" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Reload</button>
        <button id="btnExport" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white">Export CSV</button>
      </div>
    </div>

    <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4">
      <div class="grid grid-cols-1 md:grid-cols-6 gap-2">
        <input id="q" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2 md:col-span-2" placeholder="q (route/action/meta)">
        <input id="actor" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="actor_user_id">
        <input id="action" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="action">
        <input id="status" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="http_status">
        <select id="limit" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="80">80</option>
          <option value="120">120</option>
          <option value="200">200</option>
        </select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
        <input id="from" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="from epoch sec (optional)">
        <input id="to" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="to epoch sec (optional)">
        <button id="btnSearch" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Search</button>
        <button id="btnClear" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Clear</button>
      </div>
    </div>

    <div id="table" class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm overflow-hidden"></div>

    <details class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-3">
      <summary class="text-xs text-slate-500">Debug</summary>
      <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap mt-2"></pre>
    </details>
  </div>
  `;

  const el=(id)=>document.getElementById(id);
  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  function qs(){
    const p = new URLSearchParams();
    ["q","actor","action","status","from","to","limit"].forEach(k=>{
      const v = (el(k)?.value||"").trim();
      if(v) p.set(k,v);
    });
    return p.toString();
  }

  async function load(){
    const r = await api("/api/audit?"+qs());
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }

    const rows = r.data.rows || [];
    el("table").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">At</th>
              <th class="px-4 py-3 font-semibold">Actor</th>
              <th class="px-4 py-3 font-semibold">Action</th>
              <th class="px-4 py-3 font-semibold">Route</th>
              <th class="px-4 py-3 font-semibold">HTTP</th>
              <th class="px-4 py-3 font-semibold">ms</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(x=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3 text-[11px] text-slate-500">${esc(String(x.created_at||""))}</td>
                <td class="px-4 py-3"><code>${esc(x.actor_user_id||"")}</code></td>
                <td class="px-4 py-3"><code>${esc(x.action||"")}</code></td>
                <td class="px-4 py-3 text-slate-600 dark:text-slate-300">${esc(x.route||"")}</td>
                <td class="px-4 py-3">${esc(String(x.http_status||0))}</td>
                <td class="px-4 py-3">${esc(String(x.duration_ms||0))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  el("btnReload").onclick = load;
  el("btnSearch").onclick = load;
  el("btnClear").onclick = ()=>{
    ["q","actor","action","status","from","to"].forEach(k=>el(k).value="");
    el("limit").value="80";
    load();
  };

  el("btnExport").onclick = ()=>{
    const url = "/api/audit/export?"+qs();
    window.open(url, "_blank");
  };

  await load();
}

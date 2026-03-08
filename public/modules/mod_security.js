export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      ${kpi("Active IP Blocks","k1")}
      ${kpi("Password Fail","k2")}
      ${kpi("Rate Limited","k3")}
      ${kpi("Session Anomaly","k4")}
    </div>

    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm mt-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-bold">Top IP Activity</div>
          <div class="text-xs text-slate-500 mt-1">From /api/security/ip-activity</div>
        </div>
        <button id="secReload" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
      </div>
      <div id="secTable" class="mt-4 overflow-x-auto"></div>
    </div>
  `;

  async function load(){
    const m = await api("/api/security/metrics?days=7");
    if(m.status !== "ok"){ toast("metrics failed: "+m.status, "error"); return; }

    const series = m.data.series || [];
    const sum = (k)=>series.reduce((a,x)=>a+Number(x[k]||0),0);

    set("k1", m.data.active_ip_blocks);
    set("k2", sum("password_fail"));
    set("k3", sum("rate_limited"));
    set("k4", sum("session_anomaly"));

    const t = await api("/api/security/ip-activity?kind=password_fail&minutes=240&limit=20");
    if(t.status !== "ok"){ toast("ip-activity failed: "+t.status, "error"); return; }
    const rows = t.data.rows || [];
    document.getElementById("secTable").innerHTML = `
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
              <td class="px-4 py-3"><code>${esc(x.ip_hash||"")}</code></td>
              <td class="px-4 py-3 font-bold">${esc(String(x.total||0))}</td>
              <td class="px-4 py-3 text-slate-500">${esc(String(x.last_seen_at||""))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  document.getElementById("secReload").onclick = load;
  await load();
}

function kpi(label,id){
  return `
  <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
    <div class="text-xs font-medium text-slate-500">${label}</div>
    <div id="${id}" class="text-2xl font-bold text-slate-900 dark:text-white mt-1">—</div>
  </div>`;
}
function set(id,v){ const el=document.getElementById(id); if(el) el.textContent=(v??"—"); }
function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

export default function IncidentsAlertsModule(ctx){
  const { api, toast, esc, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Incidents & Alerts</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Alert Rules (plug-and-play). Incidents list bisa ditambahkan next.</p>
      </div>
      <div class="flex gap-2">
        <button id="btnNewRule" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">
          <i class="fa-solid fa-plus mr-2"></i>New Rule
        </button>
        <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">
          Reload
        </button>
      </div>
    </div>

    <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl overflow-hidden mt-5">
      <div class="p-4 border-b border-slate-200 dark:border-darkBorder bg-slate-50/50 dark:bg-white/5">
        <div class="text-xs font-bold">Alert Rules</div>
        <div class="text-[11px] text-slate-500 mt-1">metric contoh: rate_limited, lockouts, password_fail, session_anomaly, otp_verify_fail</div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">Enabled</th>
              <th class="px-4 py-3 font-semibold">Metric</th>
              <th class="px-4 py-3 font-semibold">Window</th>
              <th class="px-4 py-3 font-semibold">Threshold</th>
              <th class="px-4 py-3 font-semibold">Severity</th>
              <th class="px-4 py-3 font-semibold">Cooldown</th>
              <th class="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="ruleRows" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
        </table>
      </div>
    </div>
  `;

  async function load(){
    const r = await api("/api/ops/alert-rules");
    const body = el.querySelector("#ruleRows");
    if(r.status!=="ok"){
      body.innerHTML = `<tr><td class="px-4 py-4 text-xs text-slate-500" colspan="7">Failed: ${esc(r.status)}</td></tr>`;
      return;
    }
    const rows = r.data.rows || [];
    body.innerHTML = rows.map(x=>`
      <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
        <td class="px-4 py-3">${x.enabled ? "yes" : "no"}</td>
        <td class="px-4 py-3"><code>${esc(x.metric||"")}</code></td>
        <td class="px-4 py-3">${esc(String(x.window_minutes||0))}m</td>
        <td class="px-4 py-3"><b>${esc(String(x.threshold||0))}</b></td>
        <td class="px-4 py-3">${esc(String(x.severity||""))}</td>
        <td class="px-4 py-3">${esc(String(x.cooldown_minutes||0))}m</td>
        <td class="px-4 py-3 text-right">
          <button class="px-2 py-1 rounded-md border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 btnToggle" data-id="${esc(x.id)}" data-enabled="${x.enabled?1:0}">
            ${x.enabled ? "Disable" : "Enable"}
          </button>
          <button class="px-2 py-1 rounded-md border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 btnEdit" data-id="${esc(x.id)}">Edit</button>
          <button class="px-2 py-1 rounded-md border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-red-500 btnDel" data-id="${esc(x.id)}">Delete</button>
        </td>
      </tr>
    `).join("");

    body.querySelectorAll(".btnToggle").forEach(b=>{
      b.onclick = async ()=>{
        const id = b.getAttribute("data-id");
        const enabled = b.getAttribute("data-enabled")==="1" ? 0 : 1;
        const rr = await api("/api/ops/alert-rules", { method:"PUT", body: JSON.stringify({ id, enabled }) });
        toast(rr.status, rr.status==="ok"?"success":"error");
        await load();
      };
    });

    body.querySelectorAll(".btnEdit").forEach(b=>{
      b.onclick = async ()=>{
        const id = b.getAttribute("data-id");
        const metric = prompt("metric:", "");
        if(metric===null) return;
        const window_minutes = Number(prompt("window_minutes:", "60")||"60");
        const threshold = Number(prompt("threshold:", "1")||"1");
        const severity = prompt("severity (low/medium/high/critical):", "medium") || "medium";
        const cooldown_minutes = Number(prompt("cooldown_minutes:", "60")||"60");
        const rr = await api("/api/ops/alert-rules", { method:"PUT", body: JSON.stringify({ id, metric, window_minutes, threshold, severity, cooldown_minutes }) });
        toast(rr.status, rr.status==="ok"?"success":"error");
        await load();
      };
    });

    body.querySelectorAll(".btnDel").forEach(b=>{
      b.onclick = async ()=>{
        const id = b.getAttribute("data-id");
        if(!confirm("Delete rule?")) return;
        const rr = await api("/api/ops/alert-rules?id="+encodeURIComponent(id), { method:"DELETE" });
        toast(rr.status, rr.status==="ok"?"success":"error");
        await load();
      };
    });
  }

  el.querySelector("#btnNewRule").onclick = async ()=>{
    const metric = prompt("metric:", "rate_limited");
    if(!metric) return;
    const window_minutes = Number(prompt("window_minutes:", "60")||"60");
    const threshold = Number(prompt("threshold:", "10")||"10");
    const severity = prompt("severity (low/medium/high/critical):", "high") || "high";
    const cooldown_minutes = Number(prompt("cooldown_minutes:", "60")||"60");
    const rr = await api("/api/ops/alert-rules", { method:"POST", body: JSON.stringify({ metric, window_minutes, threshold, severity, cooldown_minutes, enabled: 1 }) });
    toast(rr.status, rr.status==="ok"?"success":"error");
    await load();
  };

  el.querySelector("#btnReload").onclick = load;

  return {
    mount(host){
      setBreadcrumb("/ ops / incidents");
      host.innerHTML = "";
      host.appendChild(el);
      load();
    },
    unmount(){}
  };
}

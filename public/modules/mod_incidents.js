export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="text-sm font-bold">Incidents & Alerts</div>
          <div class="text-xs text-slate-500">Incidents: <code>/api/ops/incidents</code> • Alert rules: <code>/api/alert-rules</code></div>
        </div>
        <div class="flex gap-2">
          <button id="btnReloadInc" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
          <button id="btnNewInc" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">New Incident</button>
          <button id="btnNewRule" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">New Rule</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder text-xs font-bold">Incidents</div>
          <div id="incTable" class="p-3 text-xs text-slate-500">Loading…</div>
        </div>

        <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder text-xs font-bold">Alert Rules</div>
          <div id="ruleTable" class="p-3 text-xs text-slate-500">Loading…</div>
        </div>
      </div>

      <details>
        <summary class="text-xs text-slate-500">Debug</summary>
        <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
      </details>
    </div>
  `;

  const $ = (id)=>document.getElementById(id);

  async function load(){
    const inc = await api("/api/ops/incidents?limit=50");
    const rules = await api("/api/alert-rules");
    $("dbg").textContent = JSON.stringify({ inc, rules }, null, 2);

    // Incidents table
    if(inc.status!=="ok"){
      $("incTable").textContent = "Failed: "+inc.status;
    }else{
      const rows = inc.data.rows || [];
      $("incTable").innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="text-slate-500">
              <tr>
                <th class="py-2 pr-3">Severity</th>
                <th class="py-2 pr-3">Status</th>
                <th class="py-2 pr-3">Summary</th>
                <th class="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
              ${rows.map(r=>`
                <tr>
                  <td class="py-2 pr-3 font-bold">${esc(r.severity)}</td>
                  <td class="py-2 pr-3">${esc(r.status)}</td>
                  <td class="py-2 pr-3">${esc(r.summary)}</td>
                  <td class="py-2 pr-1 text-right">
                    <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-ack="${r.id}">Ack</button>
                    <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-close="${r.id}">Close</button>
                    <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-reopen="${r.id}">Reopen</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      host.querySelectorAll("[data-ack]").forEach(b=>b.onclick=()=>doAction("ack", b.dataset.ack));
      host.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>doAction("close", b.dataset.close));
      host.querySelectorAll("[data-reopen]").forEach(b=>b.onclick=()=>doAction("reopen", b.dataset.reopen));
    }

    // Rules table
    if(rules.status!=="ok"){
      $("ruleTable").textContent = "Failed: "+rules.status;
    }else{
      const rows = rules.data.rows || [];
      $("ruleTable").innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="text-slate-500">
              <tr>
                <th class="py-2 pr-3">Enabled</th>
                <th class="py-2 pr-3">Metric</th>
                <th class="py-2 pr-3">Window</th>
                <th class="py-2 pr-3">Threshold</th>
                <th class="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
              ${rows.map(r=>`
                <tr>
                  <td class="py-2 pr-3">${r.enabled ? "1" : "0"}</td>
                  <td class="py-2 pr-3 font-bold">${esc(r.metric)}</td>
                  <td class="py-2 pr-3">${esc(r.window_minutes)}m</td>
                  <td class="py-2 pr-3">${esc(r.threshold)}</td>
                  <td class="py-2 pr-1 text-right">
                    <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-toggle="${r.id}" data-enabled="${r.enabled}">${r.enabled? "Disable":"Enable"}</button>
                    <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-del="${r.id}">Delete</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      host.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>toggleRule(b.dataset.toggle, b.dataset.enabled));
      host.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>delRule(b.dataset.del));
    }
  }

  function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

  async function doAction(action, id){
    const r = await api("/api/ops/incidents", { method:"PUT", body: JSON.stringify({ action, id }) });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await load();
  }

  async function toggleRule(id, enabled){
    const en = String(enabled)==="1" || String(enabled)==="true";
    const r = await api("/api/alert-rules", { method:"PUT", body: JSON.stringify({ id, enabled: en?0:1 }) });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await load();
  }

  async function delRule(id){
    if(!confirm("Delete rule?")) return;
    const r = await api("/api/alert-rules?id="+encodeURIComponent(id), { method:"DELETE" });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await load();
  }

  $("#btnReloadInc").onclick = load;

  $("#btnNewInc").onclick = async ()=>{
    const severity = prompt("severity: low|medium|high|critical", "medium") || "medium";
    const type = prompt("type:", "general") || "general";
    const summary = prompt("summary:", "") || "";
    if(!summary.trim()) return;
    const r = await api("/api/ops/incidents", { method:"POST", body: JSON.stringify({ severity, type, summary, details:{} }) });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await load();
  };

  $("#btnNewRule").onclick = async ()=>{
    const metric = prompt("metric (example: password_fail)", "password_fail") || "";
    const window_minutes = Number(prompt("window_minutes", "5") || "5");
    const threshold = Number(prompt("threshold", "10") || "10");
    const severity = prompt("severity", "medium") || "medium";
    const cooldown_minutes = Number(prompt("cooldown_minutes", "60") || "60");
    if(!metric.trim()) return;
    const r = await api("/api/alert-rules", { method:"POST", body: JSON.stringify({ metric, window_minutes, threshold, severity, cooldown_minutes, enabled:1 }) });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await load();
  };

  await load();
}

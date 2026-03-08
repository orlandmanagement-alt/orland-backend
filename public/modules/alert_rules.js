export default function AlertRulesModule(ctx){
  const { api, toast, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Alert Rules</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Manage alert_rules table.</p>
      </div>
      <div class="flex gap-2">
        <button id="btnReload" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Reload</button>
        <button id="btnNew" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">New</button>
      </div>
    </div>

    <div id="newBox" class="hidden mt-4 bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
      <div class="font-bold">Create Rule</div>
      <div class="grid grid-cols-1 md:grid-cols-6 gap-2 mt-3">
        <input id="metric" placeholder="metric (e.g. password_fail)" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs md:col-span-2">
        <input id="window" placeholder="window_minutes" value="60" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
        <input id="threshold" placeholder="threshold" value="10" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
        <select id="severity" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          <option>low</option><option selected>medium</option><option>high</option><option>critical</option>
        </select>
        <input id="cooldown" placeholder="cooldown_minutes" value="60" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
      </div>
      <label class="flex items-center gap-2 text-xs text-slate-500 mt-3">
        <input id="enabled" type="checkbox" checked> enabled
      </label>
      <div class="mt-3 flex gap-2">
        <button id="btnCreate" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Create</button>
        <button id="btnCancel" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Cancel</button>
      </div>
    </div>

    <div id="list" class="mt-4"></div>

    <details class="mt-4">
      <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
      <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
    </details>
  `;

  async function load(){
    const r = await api("/api/alerts/rules");
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("load failed: "+r.status,"error"); return; }

    const rows = r.data.rows || [];
    el.querySelector("#list").innerHTML = `
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
              <tr>
                <th class="px-4 py-3">Enabled</th>
                <th class="px-4 py-3">Metric</th>
                <th class="px-4 py-3">Window</th>
                <th class="px-4 py-3">Threshold</th>
                <th class="px-4 py-3">Severity</th>
                <th class="px-4 py-3">Cooldown</th>
                <th class="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
              ${rows.map(x=>`
                <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td class="px-4 py-3">
                    <input class="tg" type="checkbox" data-id="${x.id}" ${Number(x.enabled)?'checked':''}>
                  </td>
                  <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">${x.metric}</td>
                  <td class="px-4 py-3">${x.window_minutes}</td>
                  <td class="px-4 py-3">${x.threshold}</td>
                  <td class="px-4 py-3">${x.severity}</td>
                  <td class="px-4 py-3">${x.cooldown_minutes}</td>
                  <td class="px-4 py-3 text-right">
                    <button class="btnEdit text-slate-400 hover:text-primary mx-1" data-json='${escapeHtml(JSON.stringify(x))}' title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btnDel text-slate-400 hover:text-danger mx-1" data-id="${x.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // toggle enabled quick
    el.querySelectorAll(".tg").forEach(cb=>cb.onchange = async ()=>{
      const id = cb.getAttribute("data-id");
      const cur = rows.find(x=>x.id===id);
      const rr = await api("/api/alerts/rules", { method:"PUT", body: JSON.stringify({ ...cur, id, enabled: cb.checked?1:0 }) });
      toast(rr.status, rr.status==="ok"?"success":"error");
    });

    // edit
    el.querySelectorAll(".btnEdit").forEach(b=>b.onclick = async ()=>{
      const obj = JSON.parse(b.getAttribute("data-json")||"{}");
      const metric = prompt("metric:", obj.metric)||obj.metric;
      const window_minutes = Number(prompt("window_minutes:", String(obj.window_minutes))||obj.window_minutes);
      const threshold = Number(prompt("threshold:", String(obj.threshold))||obj.threshold);
      const severity = prompt("severity(low/medium/high/critical):", obj.severity)||obj.severity;
      const cooldown_minutes = Number(prompt("cooldown_minutes:", String(obj.cooldown_minutes))||obj.cooldown_minutes);
      const enabled = confirm("Enabled?") ? 1 : 0;
      const rr = await api("/api/alerts/rules", { method:"PUT", body: JSON.stringify({ id: obj.id, metric, window_minutes, threshold, severity, cooldown_minutes, enabled }) });
      toast(rr.status, rr.status==="ok"?"success":"error");
      if(rr.status==="ok") load();
    });

    // delete
    el.querySelectorAll(".btnDel").forEach(b=>b.onclick = async ()=>{
      const id=b.getAttribute("data-id");
      if(!confirm("Delete rule?")) return;
      const rr = await api("/api/alerts/rules?id="+encodeURIComponent(id), { method:"DELETE" });
      toast(rr.status, rr.status==="ok"?"success":"error");
      if(rr.status==="ok") load();
    });
  }

  function escapeHtml(s){
    return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll("'","&#39;");
  }

  async function create(){
    const metric = el.querySelector("#metric").value.trim();
    const window_minutes = Number(el.querySelector("#window").value||60);
    const threshold = Number(el.querySelector("#threshold").value||1);
    const severity = el.querySelector("#severity").value;
    const cooldown_minutes = Number(el.querySelector("#cooldown").value||60);
    const enabled = el.querySelector("#enabled").checked ? 1 : 0;

    if(!metric){ toast("metric required","error"); return; }

    const rr = await api("/api/alerts/rules", { method:"POST", body: JSON.stringify({ metric, window_minutes, threshold, severity, cooldown_minutes, enabled }) });
    toast(rr.status, rr.status==="ok"?"success":"error");
    if(rr.status==="ok"){
      el.querySelector("#newBox").classList.add("hidden");
      load();
    }
  }

  return {
    mount(host){
      setBreadcrumb("/ alerts");
      host.innerHTML="";
      host.appendChild(el);

      el.querySelector("#btnReload").onclick = load;
      el.querySelector("#btnNew").onclick = ()=> el.querySelector("#newBox").classList.toggle("hidden");
      el.querySelector("#btnCancel").onclick = ()=> el.querySelector("#newBox").classList.add("hidden");
      el.querySelector("#btnCreate").onclick = create;

      load();
    },
    unmount(){}
  };
}

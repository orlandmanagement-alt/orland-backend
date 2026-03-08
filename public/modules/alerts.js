(function(){
  const M = window.Orland?.Modules;
  const API = window.Orland?.API;
  if(!M || !API) return;

  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  M.register("/alerts", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-5">
        <div class="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Alert Rules</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Create/update thresholds and enable/disable rules.</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnNew" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">
              <i class="fa-solid fa-plus mr-2"></i>New Rule
            </button>
            <button id="btnLoad" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:opacity-90 dark:bg-white dark:text-slate-900">
              <i class="fa-solid fa-rotate mr-2"></i>Reload
            </button>
          </div>
        </div>

        <div id="form" class="hidden bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <input id="id" type="hidden">
          <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div class="md:col-span-2">
              <label class="text-xs text-slate-500">Metric</label>
              <input id="metric" class="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" placeholder="password_fail|rate_limited|session_anomaly">
            </div>
            <div>
              <label class="text-xs text-slate-500">Window (min)</label>
              <input id="win" type="number" class="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" value="15">
            </div>
            <div>
              <label class="text-xs text-slate-500">Threshold</label>
              <input id="thr" type="number" class="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" value="10">
            </div>
            <div>
              <label class="text-xs text-slate-500">Severity</label>
              <select id="sev" class="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm">
                <option>low</option><option selected>medium</option><option>high</option><option>critical</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-500">Cooldown (min)</label>
              <input id="cool" type="number" class="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" value="60">
            </div>
            <div class="md:col-span-6 flex items-center gap-3 mt-2">
              <label class="text-xs text-slate-500 flex items-center gap-2">
                <input id="en" type="checkbox" checked>
                enabled
              </label>
              <button id="btnSave" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Save</button>
              <button id="btnCancel" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs font-bold">Cancel</button>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl overflow-hidden">
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
              <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
            </table>
          </div>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="dbg" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    const tb = document.getElementById("tb");
    const dbg = document.getElementById("dbg");
    const form = document.getElementById("form");

    function fill(x){
      document.getElementById("id").value = x?.id||"";
      document.getElementById("metric").value = x?.metric||"password_fail";
      document.getElementById("win").value = x?.window_minutes||15;
      document.getElementById("thr").value = x?.threshold||10;
      document.getElementById("sev").value = x?.severity||"medium";
      document.getElementById("cool").value = x?.cooldown_minutes||60;
      document.getElementById("en").checked = Number(x?.enabled??1) ? true : false;
    }

    async function load(){
      const r = await API.req("/api/alerts");
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok"){
        tb.innerHTML = `<tr><td class="px-4 py-4 text-slate-500" colspan="7">Failed: ${esc(r.status)}</td></tr>`;
        return;
      }
      const rows = r.data.rows||[];
      tb.innerHTML = rows.map(x=>`
        <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
          <td class="px-4 py-3">${Number(x.enabled)?'✅':'❌'}</td>
          <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white">${esc(x.metric)}</td>
          <td class="px-4 py-3 text-slate-500">${esc(String(x.window_minutes))}m</td>
          <td class="px-4 py-3 text-slate-500">${esc(String(x.threshold))}</td>
          <td class="px-4 py-3 text-slate-500">${esc(String(x.severity))}</td>
          <td class="px-4 py-3 text-slate-500">${esc(String(x.cooldown_minutes))}m</td>
          <td class="px-4 py-3 text-right">
            <button class="px-2 py-1 text-[10px] rounded bg-slate-100 dark:bg-dark border border-slate-200 dark:border-darkBorder btnEdit" data-id="${esc(x.id)}">Edit</button>
            <button class="px-2 py-1 text-[10px] rounded bg-slate-100 dark:bg-dark border border-slate-200 dark:border-darkBorder btnDel" data-id="${esc(x.id)}">Delete</button>
          </td>
        </tr>
      `).join("") || `<tr><td class="px-4 py-4 text-slate-500" colspan="7">No rules.</td></tr>`;

      host.querySelectorAll(".btnEdit").forEach(b=>b.onclick=()=>{
        const id=b.getAttribute("data-id");
        const row=rows.find(z=>z.id===id);
        fill(row);
        form.classList.remove("hidden");
      });

      host.querySelectorAll(".btnDel").forEach(b=>b.onclick=async()=>{
        const id=b.getAttribute("data-id");
        if(!confirm("Delete rule?")) return;
        const rr=await API.req("/api/alerts?id="+encodeURIComponent(id),{method:"DELETE"});
        dbg.textContent=JSON.stringify(rr,null,2);
        await load();
      });
    }

    document.getElementById("btnNew").onclick=()=>{
      fill(null);
      form.classList.remove("hidden");
    };
    document.getElementById("btnCancel").onclick=()=> form.classList.add("hidden");
    document.getElementById("btnSave").onclick=async()=>{
      const payload={
        id: document.getElementById("id").value.trim() || null,
        enabled: document.getElementById("en").checked ? 1 : 0,
        metric: document.getElementById("metric").value.trim() || "password_fail",
        window_minutes: Number(document.getElementById("win").value||15),
        threshold: Number(document.getElementById("thr").value||10),
        severity: document.getElementById("sev").value,
        cooldown_minutes: Number(document.getElementById("cool").value||60),
      };
      const rr=await API.req("/api/alerts",{method:"POST",body:JSON.stringify(payload)});
      dbg.textContent=JSON.stringify(rr,null,2);
      if(rr.status==="ok"){ form.classList.add("hidden"); await load(); }
      else alert(rr.status);
    };
    document.getElementById("btnLoad").onclick=load;

    await load();
  });
})();

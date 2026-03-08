(function(){
  const M = window.Orland?.Modules;
  const API = window.Orland?.API;
  if(!M || !API) return;
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  M.register("/alerts", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Alert Rules</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">CRUD alert rules (metric/window/threshold/severity).</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnReloadAlerts" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:opacity-90 dark:bg-slate-200 dark:text-slate-900">
              <i class="fa-solid fa-rotate-right mr-2"></i>Reload
            </button>
            <button id="btnNewAlert" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">
              <i class="fa-solid fa-plus mr-2"></i>New Rule
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl overflow-hidden">
          <div class="p-4 border-b border-slate-200 dark:border-darkBorder bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
            <div class="text-xs text-slate-500">Rules</div>
            <div class="text-[11px] text-slate-500">super_admin/admin</div>
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
                  <th class="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody id="alertsRows" class="divide-y divide-slate-100 dark:divide-darkBorder">
                <tr><td class="px-4 py-3 text-slate-500" colspan="7">Loading…</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="alertsDebug" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>

        <!-- Modal -->
        <div id="modalAlert" class="fixed inset-0 z-[120] hidden">
          <div class="absolute inset-0 bg-black/60"></div>
          <div class="relative max-w-xl mx-auto mt-16 bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-5 shadow-2xl">
            <div class="flex items-center justify-between">
              <div class="text-sm font-bold" id="alertTitle">Create Alert Rule</div>
              <button id="alertClose" class="text-slate-400 hover:text-slate-200"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <input type="hidden" id="alertId" value="">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div class="md:col-span-2">
                <div class="text-[11px] text-slate-500 mb-1">Metric</div>
                <input id="alertMetric" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" placeholder="password_fail / rate_limited / session_anomaly">
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">Window (minutes)</div>
                <input id="alertWindow" type="number" value="60" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm">
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">Threshold</div>
                <input id="alertThreshold" type="number" value="10" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm">
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">Severity</div>
                <select id="alertSeverity" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm">
                  <option value="low">low</option>
                  <option value="medium" selected>medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">Cooldown (minutes)</div>
                <input id="alertCooldown" type="number" value="60" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm">
              </div>

              <div class="md:col-span-2 flex items-center gap-2 mt-1">
                <input id="alertEnabled" type="checkbox" checked>
                <label for="alertEnabled" class="text-xs text-slate-600 dark:text-slate-300">Enabled</label>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 mt-4">
              <button id="alertCancel" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:opacity-90 dark:bg-white/10 dark:text-slate-200">Cancel</button>
              <button id="alertSave" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const rowsEl = document.getElementById("alertsRows");
    const dbg = document.getElementById("alertsDebug");
    const modal = document.getElementById("modalAlert");
    const openModal = (r)=>{
      modal.classList.remove("hidden");
      document.getElementById("alertId").value = r?.id || "";
      document.getElementById("alertMetric").value = r?.metric || "";
      document.getElementById("alertWindow").value = Number(r?.window_minutes||60);
      document.getElementById("alertThreshold").value = Number(r?.threshold||10);
      document.getElementById("alertSeverity").value = r?.severity || "medium";
      document.getElementById("alertCooldown").value = Number(r?.cooldown_minutes||60);
      document.getElementById("alertEnabled").checked = Number(r?.enabled ?? 1) ? true : false;
      document.getElementById("alertTitle").textContent = r?.id ? "Edit Alert Rule" : "Create Alert Rule";
    };
    const closeModal = ()=> modal.classList.add("hidden");
    document.getElementById("alertClose").onclick = closeModal;
    document.getElementById("alertCancel").onclick = closeModal;
    modal.addEventListener("click",(e)=>{ if(e.target === modal.firstElementChild) closeModal(); });

    document.getElementById("btnNewAlert").onclick = ()=> openModal(null);

    async function load(){
      const r = await API.req("/api/alerts");
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok"){ rowsEl.innerHTML = `<tr><td class="px-4 py-3 text-slate-500" colspan="7">Failed: ${esc(r.status)}</td></tr>`; return; }
      const rows = r.data.rules || [];
      if(!rows.length){ rowsEl.innerHTML = `<tr><td class="px-4 py-3 text-slate-500" colspan="7">No rules</td></tr>`; return; }

      rowsEl.innerHTML = rows.map(x=>`
        <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
          <td class="px-4 py-3">
            <input type="checkbox" data-tg="${esc(x.id)}" ${Number(x.enabled)?'checked':''}>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white">${esc(x.metric)}</td>
          <td class="px-4 py-3">${esc(String(x.window_minutes))}m</td>
          <td class="px-4 py-3">${esc(String(x.threshold))}</td>
          <td class="px-4 py-3"><span class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10">${esc(x.severity)}</span></td>
          <td class="px-4 py-3">${esc(String(x.cooldown_minutes))}m</td>
          <td class="px-4 py-3 text-right">
            <button class="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold dark:bg-white/10 dark:text-slate-200" data-edit='${esc(JSON.stringify(x))}'>Edit</button>
            <button class="px-2 py-1 rounded-lg bg-danger/15 text-danger text-[10px] font-bold" data-del="${esc(x.id)}">Del</button>
          </td>
        </tr>
      `).join("");

      rowsEl.querySelectorAll("[data-edit]").forEach(b=>{
        b.onclick = ()=> openModal(JSON.parse(b.getAttribute("data-edit")||"{}"));
      });
      rowsEl.querySelectorAll("[data-del]").forEach(b=>{
        b.onclick = async ()=>{
          const id = b.getAttribute("data-del");
          if(!confirm("Delete rule?")) return;
          const rr = await API.req("/api/alerts?id="+encodeURIComponent(id), { method:"DELETE" });
          dbg.textContent = JSON.stringify(rr,null,2);
          if(rr.status!=="ok") return alert("Delete failed: "+rr.status);
          await load();
        };
      });
      rowsEl.querySelectorAll("[data-tg]").forEach(cb=>{
        cb.onchange = async ()=>{
          const id = cb.getAttribute("data-tg");
          const enabled = cb.checked ? 1 : 0;
          const rr = await API.req("/api/alerts", { method:"PUT", body: JSON.stringify({ id, enabled }) });
          dbg.textContent = JSON.stringify(rr,null,2);
        };
      });
    }

    document.getElementById("alertSave").onclick = async ()=>{
      const id = String(document.getElementById("alertId").value||"").trim();
      const metric = String(document.getElementById("alertMetric").value||"").trim();
      const window_minutes = Number(document.getElementById("alertWindow").value||60);
      const threshold = Number(document.getElementById("alertThreshold").value||10);
      const severity = String(document.getElementById("alertSeverity").value||"medium").trim();
      const cooldown_minutes = Number(document.getElementById("alertCooldown").value||60);
      const enabled = document.getElementById("alertEnabled").checked ? 1 : 0;

      if(!metric) return alert("Metric wajib.");
      const payload = { metric, window_minutes, threshold, severity, cooldown_minutes, enabled };

      let rr;
      if(id){
        rr = await API.req("/api/alerts", { method:"PUT", body: JSON.stringify({ ...payload, id }) });
      } else {
        rr = await API.req("/api/alerts", { method:"POST", body: JSON.stringify(payload) });
      }
      dbg.textContent = JSON.stringify(rr,null,2);
      if(rr.status!=="ok") return alert("Save failed: "+rr.status);
      closeModal();
      await load();
    };

    document.getElementById("btnReloadAlerts").onclick = load;
    await load();
  });
})();

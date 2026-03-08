/**
 * Security Center module
 * Routes:
 * - /security
 */
(function(){
  const M = window.Orland?.Modules;
  const API = window.Orland?.API;
  if(!M || !API) return;

  M.register("/security", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Security Center</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Rate limit, lock policy, IP blocks, and top IP activity.</p>
          </div>
          <button id="btnRefreshSec" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">
            <i class="fa-solid fa-rotate-right mr-2"></i>Refresh
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
            <div class="font-bold mb-3">Security Policy</div>
            <div class="space-y-2 text-xs">
              <label class="block">API RPM
                <input id="pol_api_rpm" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder" type="number" min="30" max="2000">
              </label>
              <label class="block">API Window (sec)
                <input id="pol_api_window" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder" type="number" min="10" max="300">
              </label>
              <label class="block">Lock after fail
                <input id="pol_lock_after" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder" type="number" min="3" max="50">
              </label>
              <label class="block">Lock minutes
                <input id="pol_lock_minutes" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder" type="number" min="1" max="1440">
              </label>
              <button id="btnSavePolicy" class="w-full mt-2 px-3 py-2 rounded-lg bg-success text-white text-xs font-bold hover:opacity-90">
                <i class="fa-solid fa-floppy-disk mr-2"></i>Save Policy
              </button>
              <div id="polMsg" class="text-[11px] text-slate-500"></div>
            </div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 lg:col-span-2">
            <div class="flex items-center justify-between mb-3">
              <div class="font-bold">Top IP Activity (last 4h)</div>
              <div class="text-[11px] text-slate-500">api_rq / password_fail / session_anomaly</div>
            </div>
            <div id="topIpTable" class="text-xs text-slate-500">Loading…</div>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="font-bold">Active IP Blocks</div>
            <div class="flex gap-2">
              <button id="btnPurgeBlocks" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-dark text-xs font-bold border border-slate-200 dark:border-darkBorder hover:opacity-90">
                Purge expired
              </button>
            </div>
          </div>
          <div id="ipBlocksTable" class="text-xs text-slate-500">Loading…</div>
        </div>
      </div>
    `;

    async function loadPolicy(){
      const r = await API.req("/api/security/policy");
      if(r.status !== "ok"){
        document.getElementById("polMsg").textContent = "Failed: " + r.status;
        return null;
      }
      const p = r.data.policy || {};
      document.getElementById("pol_api_rpm").value = p.api_rpm ?? 120;
      document.getElementById("pol_api_window").value = p.api_window_sec ?? 60;
      document.getElementById("pol_lock_after").value = p.lock_after_fail ?? 10;
      document.getElementById("pol_lock_minutes").value = p.lock_minutes ?? 30;
      document.getElementById("polMsg").textContent = "";
      return p;
    }

    async function savePolicy(){
      const policy = {
        api_rpm: Number(document.getElementById("pol_api_rpm").value || 120),
        api_window_sec: Number(document.getElementById("pol_api_window").value || 60),
        lock_after_fail: Number(document.getElementById("pol_lock_after").value || 10),
        lock_minutes: Number(document.getElementById("pol_lock_minutes").value || 30),
      };
      const r = await API.req("/api/security/policy", { method:"POST", body: JSON.stringify(policy) });
      document.getElementById("polMsg").textContent = (r.status==="ok") ? "Saved ✅" : ("Failed: "+r.status);
    }

    async function loadTop(){
      // Uses new endpoint top.js (or existing ip-activity API if you prefer)
      const kinds = ["api_rq","password_fail","session_anomaly"];
      const parts = await Promise.all(kinds.map(k=>API.req(`/api/security/ip-activity/top?kind=${encodeURIComponent(k)}&minutes=240&limit=15`)));
      const rows = [];
      for(let i=0;i<kinds.length;i++){
        const r = parts[i];
        if(r.status==="ok"){
          (r.data.rows||[]).forEach(x=>rows.push({ kind:kinds[i], ...x }));
        }
      }
      rows.sort((a,b)=>Number(b.total||0)-Number(a.total||0));

      const el = document.getElementById("topIpTable");
      if(!rows.length){
        el.innerHTML = `<div class="text-slate-500">No activity.</div>`;
        return;
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
              <tr><th class="py-2 pr-3">Kind</th><th class="py-2 pr-3">IP Hash</th><th class="py-2 pr-3">Total</th><th class="py-2">Last Seen</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
              ${rows.map(x=>`
                <tr>
                  <td class="py-2 pr-3 font-bold">${x.kind}</td>
                  <td class="py-2 pr-3"><code>${x.ip_hash||""}</code></td>
                  <td class="py-2 pr-3 font-bold">${x.total||0}</td>
                  <td class="py-2 text-slate-500">${x.last_seen_at||""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    async function loadIpBlocks(){
      const r = await API.req("/api/ip-blocks?active=1&limit=200");
      const el = document.getElementById("ipBlocksTable");
      if(r.status !== "ok"){
        el.textContent = "Failed: " + r.status;
        return;
      }
      const rows = r.data.blocks || [];
      if(!rows.length){
        el.innerHTML = `<div class="text-slate-500">No active blocks.</div>`;
        return;
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
              <tr><th class="py-2 pr-3">Reason</th><th class="py-2 pr-3">Expires</th><th class="py-2 pr-3">IP Hash</th><th class="py-2">Action</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
              ${rows.map(b=>`
                <tr>
                  <td class="py-2 pr-3">${b.reason||""}</td>
                  <td class="py-2 pr-3 text-slate-500">${b.expires_at||""}</td>
                  <td class="py-2 pr-3"><code>${b.ip_hash||""}</code></td>
                  <td class="py-2">
                    <button data-unblock="${b.id}" class="px-3 py-1.5 rounded-lg bg-danger/10 text-danger text-xs font-bold hover:opacity-90">Unblock</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;

      el.querySelectorAll("[data-unblock]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const id = btn.getAttribute("data-unblock");
          const rr = await API.req("/api/ip-blocks/unblock", { method:"POST", body: JSON.stringify({ id }) });
          if(rr.status==="ok") await loadIpBlocks();
          else alert("Failed: " + rr.status);
        });
      });
    }

    document.getElementById("btnSavePolicy").addEventListener("click", savePolicy);
    document.getElementById("btnRefreshSec").addEventListener("click", async ()=>{
      await loadPolicy(); await loadTop(); await loadIpBlocks();
    });
    document.getElementById("btnPurgeBlocks").addEventListener("click", async ()=>{
      const rr = await API.req("/api/ip-blocks/purge", { method:"POST", body:"{}" });
      alert("Purged: " + (rr.data?.revoked || 0));
      await loadIpBlocks();
    });

    await loadPolicy();
    await loadTop();
    await loadIpBlocks();
  });

})();

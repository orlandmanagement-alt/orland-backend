(function(){
  const M = window.Orland?.Modules, API = window.Orland?.API;
  if(!M || !API) return;

  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  M.register("/ops/incidents", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Incidents & Alerts</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Create/ack/close incidents (admin/super_admin).</p>
          </div>
          <button id="btnCreate" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">
            <i class="fa-solid fa-plus mr-2"></i>Create
          </button>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input id="q" class="px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="search summary/type..." />
            <select id="status" class="px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs">
              <option value="">all</option>
              <option value="open">open</option>
              <option value="ack">ack</option>
              <option value="closed">closed</option>
            </select>
            <button id="btnLoad" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold dark:bg-white dark:text-slate-900">
              <i class="fa-solid fa-rotate mr-2"></i>Reload
            </button>
          </div>
          <div id="tbl" class="overflow-x-auto"></div>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="dbg" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    const dbg = document.getElementById("dbg");

    async function load(){
      const q = document.getElementById("q").value.trim();
      const st = document.getElementById("status").value.trim();
      const url = "/api/ops/incidents?limit=80" + (q?("&q="+encodeURIComponent(q)):"") + (st?("&status="+encodeURIComponent(st)):"");
      const r = await API.req(url);
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok"){ document.getElementById("tbl").innerHTML = `<div class="text-xs text-slate-500">Failed: ${esc(r.status)}</div>`; return; }

      const rows = r.data.rows || [];
      document.getElementById("tbl").innerHTML = `
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-3 py-2 font-semibold">Severity</th>
              <th class="px-3 py-2 font-semibold">Type</th>
              <th class="px-3 py-2 font-semibold">Status</th>
              <th class="px-3 py-2 font-semibold">Summary</th>
              <th class="px-3 py-2 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(x=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-3 py-2">${esc(x.severity)}</td>
                <td class="px-3 py-2">${esc(x.type)}</td>
                <td class="px-3 py-2">${esc(x.status)}</td>
                <td class="px-3 py-2">
                  <div class="font-semibold text-slate-900 dark:text-white">${esc(x.summary)}</div>
                  <div class="text-[10px] text-slate-500">id: ${esc(x.id)}</div>
                </td>
                <td class="px-3 py-2 text-right">
                  <button class="act px-2 py-1 rounded bg-slate-100 dark:bg-darkBorder" data-a="ack" data-id="${esc(x.id)}">Ack</button>
                  <button class="act px-2 py-1 rounded bg-slate-100 dark:bg-darkBorder" data-a="close" data-id="${esc(x.id)}">Close</button>
                  <button class="act px-2 py-1 rounded bg-slate-100 dark:bg-darkBorder" data-a="reopen" data-id="${esc(x.id)}">Reopen</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;

      document.querySelectorAll(".act").forEach(b=>{
        b.onclick = async ()=>{
          const id = b.getAttribute("data-id");
          const action = b.getAttribute("data-a");
          const rr = await API.req("/api/ops/incidents",{method:"PUT", body: JSON.stringify({ id, action })});
          dbg.textContent = JSON.stringify(rr,null,2);
          alert(rr.status);
          await load();
        };
      });
    }

    document.getElementById("btnLoad").onclick = load;
    document.getElementById("btnCreate").onclick = async ()=>{
      const severity = prompt("severity (low|medium|high|critical):","low") || "low";
      const type = prompt("type:","general") || "general";
      const summary = prompt("summary:","") || "";
      if(!summary.trim()) return alert("summary required");
      const r = await API.req("/api/ops/incidents",{method:"POST", body: JSON.stringify({ severity, type, summary })});
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
      await load();
    };

    await load();
  });
})();

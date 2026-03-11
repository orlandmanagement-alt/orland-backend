export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  let cursor = null;
  let q = "";
  let limit = 50;

  async function load(host, reset=false){
    if(reset){ cursor = null; }
    host.querySelector("#rows").innerHTML = `<div class="text-xs text-slate-500">Loading…</div>`;

    const url = `/api/tenants?limit=${encodeURIComponent(limit)}`
      + (q ? `&q=${encodeURIComponent(q)}` : "")
      + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");

    const r = await Orland.api(url);
    if(r.status !== "ok"){
      host.querySelector("#rows").innerHTML = `<div class="text-xs text-red-400">Failed: ${esc(r.status)}</div>`;
      return;
    }

    const rows = r.data.rows || [];
    cursor = r.data.next_cursor || null;

    host.querySelector("#rows").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">Tenant</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold">Updated</th>
              <th class="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(x=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900 dark:text-white">${esc(x.name||"-")}</div>
                  <div class="text-[10px] text-slate-500">ID: <code>${esc(x.id||"")}</code></div>
                </td>
                <td class="px-4 py-3">
                  ${x.status==="active"
                    ? `<span class="text-success font-medium"><i class="fa-solid fa-circle text-[8px] mr-1"></i> Active</span>`
                    : `<span class="text-danger font-medium"><i class="fa-solid fa-circle text-[8px] mr-1"></i> Disabled</span>`}
                </td>
                <td class="px-4 py-3 text-[10px] text-slate-500">${esc(String(x.updated_at||""))}</td>
                <td class="px-4 py-3 text-right">
                  <button class="text-slate-400 hover:text-primary mx-1" data-act="rename" data-id="${esc(x.id)}" data-name="${esc(x.name||"")}"><i class="fa-solid fa-pen"></i></button>
                  <button class="text-slate-400 hover:text-warning mx-1" data-act="${x.status==="active"?"disable":"enable"}" data-id="${esc(x.id)}"><i class="fa-solid fa-ban"></i></button>
                  <button class="text-slate-400 hover:text-danger mx-1" data-act="delete" data-id="${esc(x.id)}"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="mt-3 flex items-center justify-between gap-2">
        <div class="text-[10px] text-slate-500">${rows.length ? `Loaded ${rows.length} row(s)` : "No data"}</div>
        <div class="flex gap-2">
          <button id="btnMore" class="px-3 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" ${cursor? "":"disabled"}>
            Load more
          </button>
        </div>
      </div>
    `;

    host.querySelector("#btnMore")?.addEventListener("click", ()=> load(host, false));

    host.querySelectorAll("[data-act]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");

        if(act === "rename"){
          const curName = btn.getAttribute("data-name") || "";
          const name = prompt("Tenant name:", curName) || "";
          if(!name.trim()) return;
          const rr = await Orland.api("/api/tenants", { method:"PUT", body: JSON.stringify({ action:"rename", id, name }) });
          alert(rr.status);
          return load(host, true);
        }

        if(act === "disable" || act === "enable"){
          if(!confirm(`${act.toUpperCase()} tenant?`)) return;
          const rr = await Orland.api("/api/tenants", { method:"PUT", body: JSON.stringify({ action:act, id }) });
          alert(rr.status);
          return load(host, true);
        }

        if(act === "delete"){
          if(!confirm("DELETE tenant? (super_admin only)")) return;
          const rr = await Orland.api("/api/tenants?id="+encodeURIComponent(id), { method:"DELETE" });
          alert(rr.status);
          return load(host, true);
        }
      });
    });
  }

  return {
    title: "Tenant Mapping",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-200 dark:border-darkBorder flex flex-wrap gap-2 items-center justify-between bg-slate-50/50 dark:bg-white/5">
            <div class="flex gap-2 flex-wrap items-center">
              <div class="relative w-72">
                <i class="fa-solid fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                <input id="q" type="text" placeholder="Search tenant..." class="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md">
              </div>
              <select id="limit" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-2 py-1.5">
                <option value="25">25</option>
                <option value="50" selected>50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
              <button id="btnSearch" class="bg-primary hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold transition">
                Search
              </button>
            </div>
            <div class="flex gap-2">
              <button id="btnCreate" class="bg-primary hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold transition">
                <i class="fa-solid fa-plus mr-1"></i> Create Tenant
              </button>
              <button id="btnReload" class="px-3 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                Reload
              </button>
            </div>
          </div>

          <div class="p-4" id="rows"></div>
        </div>
      `;

      host.querySelector("#btnSearch")?.addEventListener("click", ()=>{
        q = String(host.querySelector("#q")?.value||"").trim();
        limit = Number(host.querySelector("#limit")?.value||"50");
        load(host, true);
      });

      host.querySelector("#btnReload")?.addEventListener("click", ()=>{
        q = String(host.querySelector("#q")?.value||"").trim();
        limit = Number(host.querySelector("#limit")?.value||"50");
        load(host, true);
      });

      host.querySelector("#btnCreate")?.addEventListener("click", async ()=>{
        const name = prompt("Tenant name:", "") || "";
        if(!name.trim()) return;
        const rr = await Orland.api("/api/tenants", { method:"POST", body: JSON.stringify({ name }) });
        alert(rr.status);
        load(host, true);
      });

      // initial
      load(host, true);
    }
  };
}

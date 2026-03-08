export default function(Orland){
  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  let cursor=null, q="", limit=50;

  async function load(host, reset=false){
    if(reset) cursor=null;

    const box = host.querySelector("#rows");
    box.innerHTML = `<div class="text-xs text-slate-500">Loading…</div>`;

    const url = `/api/users/client?limit=${encodeURIComponent(limit)}`
      + (q ? `&q=${encodeURIComponent(q)}` : "")
      + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");

    const r = await Orland.api(url);
    if(r.status!=="ok"){
      box.innerHTML = `<div class="text-xs text-red-400">Failed: ${esc(r.status)}</div>`;
      return;
    }

    const rows = r.data.rows||[];
    cursor = r.data.next_cursor||null;

    box.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">Client</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(u=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900 dark:text-white">${esc(u.display_name||"-")}</div>
                  <div class="text-[10px] text-slate-500">${esc(u.email_norm||"")}</div>
                  <div class="text-[10px] text-slate-500">ID: <code>${esc(u.id||"")}</code></div>
                </td>
                <td class="px-4 py-3">${esc(u.status||"")}</td>
                <td class="px-4 py-3 text-[10px] text-slate-500">${esc(String(u.created_at||""))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <div class="text-[10px] text-slate-500">${rows.length ? `Loaded ${rows.length}` : "No data"}</div>
        <button id="btnMore" class="px-3 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" ${cursor?"":"disabled"}>
          Load more
        </button>
      </div>
    `;

    host.querySelector("#btnMore")?.addEventListener("click", ()=>load(host,false));
  }

  return {
    title:"Client Users",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-200 dark:border-darkBorder flex flex-wrap gap-2 items-center justify-between bg-slate-50/50 dark:bg-white/5">
            <div class="flex gap-2 flex-wrap items-center">
              <div class="relative w-72">
                <i class="fa-solid fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                <input id="q" type="text" placeholder="Search client..." class="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md">
              </div>
              <select id="limit" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-2 py-1.5">
                <option value="25">25</option>
                <option value="50" selected>50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
              <button id="btnSearch" class="bg-primary hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold transition">Search</button>
            </div>
            <button id="btnReload" class="px-3 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
          </div>
          <div class="p-4" id="rows"></div>
        </div>
      `;

      host.querySelector("#btnSearch")?.addEventListener("click", ()=>{
        q = String(host.querySelector("#q")?.value||"").trim();
        limit = Number(host.querySelector("#limit")?.value||"50");
        load(host,true);
      });
      host.querySelector("#btnReload")?.addEventListener("click", ()=>{
        q = String(host.querySelector("#q")?.value||"").trim();
        limit = Number(host.querySelector("#limit")?.value||"50");
        load(host,true);
      });

      load(host,true);
    }
  };
}

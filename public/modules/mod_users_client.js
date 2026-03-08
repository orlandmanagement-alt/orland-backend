export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-bold">Client Users</div>
          <div class="text-xs text-slate-500 mt-1">Read-only directory • endpoint: <code>/api/users/client</code></div>
        </div>
        <button id="clReload" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
          Reload
        </button>
      </div>

      <div class="mt-4 flex flex-wrap gap-2 items-center">
        <input id="clQ" class="text-xs w-64 bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2"
          placeholder="Search email/name (q)" />
        <select id="clLimit" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="25">25</option>
          <option value="50" selected>50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>
        <button id="clSearch" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
          Search
        </button>
        <div class="ml-auto text-[11px] text-slate-500" id="clMeta">—</div>
      </div>

      <div id="clTable" class="mt-4 overflow-x-auto"></div>
    </div>
  `;

  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const $ = (id)=>document.getElementById(id);

  $("clReload").onclick = ()=>load();
  $("clSearch").onclick = ()=>load();
  $("clQ").addEventListener("keydown",(e)=>{ if(e.key==="Enter") load(); });

  function badge(text){
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-lg border bg-slate-500/10 text-slate-400 border-slate-500/20 text-[11px] font-bold">${esc(text)}</span>`;
  }

  async function load(){
    const q = ($("clQ").value||"").trim();
    const limit = $("clLimit").value || "50";
    const url = "/api/users/client?limit="+encodeURIComponent(limit) + (q?("&q="+encodeURIComponent(q)):"");

    $("clTable").innerHTML = `<div class="text-xs text-slate-500">Loading…</div>`;
    const r = await api(url);

    if(r.status !== "ok"){
      $("clTable").innerHTML = `<div class="text-xs text-red-400">Failed: ${esc(r.status)}</div>`;
      $("clMeta").textContent = "—";
      return;
    }

    const rows = r.data.users || [];
    $("clMeta").textContent = `${rows.length} users`;

    $("clTable").innerHTML = `
      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
          <tr>
            <th class="px-4 py-3 font-semibold">Client</th>
            <th class="px-4 py-3 font-semibold">Status</th>
            <th class="px-4 py-3 font-semibold">Roles</th>
            <th class="px-4 py-3 font-semibold">Last Login</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
          ${rows.map(u=>`
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
              <td class="px-4 py-3">
                <div class="font-bold text-slate-900 dark:text-white">${esc(u.display_name||"")}</div>
                <div class="text-[11px] text-slate-500">${esc(u.email_norm||"")}</div>
                <div class="text-[11px] text-slate-500">id: <code>${esc(u.id||"")}</code></div>
              </td>
              <td class="px-4 py-3">${badge(u.status||"-")}</td>
              <td class="px-4 py-3">${badge((u.roles||[]).join(", ")||"-")}</td>
              <td class="px-4 py-3 text-slate-500">${esc(String(u.last_login_at||"-"))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  await load();
}

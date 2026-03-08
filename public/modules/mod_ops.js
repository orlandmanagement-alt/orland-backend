export async function mount(ctx){
  const { host, api, toast } = ctx;
  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-bold">OPS Management</div>
          <div class="text-xs text-slate-500 mt-1">Status summary</div>
        </div>
        <button id="opsReload" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
      </div>
      <div id="opsTable" class="mt-4"></div>
    </div>
  `;

  async function load(){
    const r = await api("/api/ops/status");
    if(r.status!=="ok"){ toast("ops failed: "+r.status,"error"); return; }
    const x = r.data;
    document.getElementById("opsTable").innerHTML = `
      <table class="w-full text-left text-xs">
        <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
          ${Object.keys(x||{}).map(k=>`
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
              <td class="px-3 py-2 text-slate-500">${k}</td>
              <td class="px-3 py-2 font-bold">${esc(String(x[k]))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
  document.getElementById("opsReload").onclick = load;
  await load();
}
function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

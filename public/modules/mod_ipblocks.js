export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-bold">Banned / IP Blocks</div>
          <div class="text-xs text-slate-500 mt-1">Manage blocked IP hashes</div>
        </div>
        <button id="ipReload" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
      </div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input id="ipHash" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2 md:col-span-2" placeholder="ip_hash"/>
        <input id="ipTtl" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" value="3600" />
        <button id="ipBlock" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Block</button>
      </div>

      <div id="ipTable" class="mt-4 overflow-x-auto"></div>
    </div>
  `;

  async function load(){
    const r = await api("/api/ip-blocks?active=1&limit=100");
    if(r.status!=="ok"){ toast("ip-blocks failed: "+r.status,"error"); return; }
    const rows = r.data.blocks || [];
    document.getElementById("ipTable").innerHTML = `
      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
          <tr><th class="px-4 py-3 font-semibold">Reason</th><th class="px-4 py-3 font-semibold">Expires</th><th class="px-4 py-3 font-semibold">IP Hash</th><th class="px-4 py-3 font-semibold text-right">Action</th></tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
          ${rows.map(b=>`
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
              <td class="px-4 py-3">${esc(b.reason||"")}</td>
              <td class="px-4 py-3 text-slate-500">${esc(String(b.expires_at||""))}</td>
              <td class="px-4 py-3"><code>${esc(b.ip_hash||"")}</code></td>
              <td class="px-4 py-3 text-right">
                <button data-unblock="${esc(b.id)}" class="text-xs px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Unblock</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    document.querySelectorAll("[data-unblock]").forEach(btn=>{
      btn.onclick = async ()=>{
        const id = btn.getAttribute("data-unblock");
        const rr = await api("/api/ip-blocks/unblock",{ method:"POST", body: JSON.stringify({ id }) });
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") load();
      };
    });
  }

  document.getElementById("ipReload").onclick = load;
  document.getElementById("ipBlock").onclick = async ()=>{
    const ip_hash = (document.getElementById("ipHash").value||"").trim();
    const ttl_sec = Number(document.getElementById("ipTtl").value||"3600");
    if(!ip_hash) return toast("ip_hash required","error");
    const rr = await api("/api/ip-blocks/block",{ method:"POST", body: JSON.stringify({ ip_hash, ttl_sec, reason:"manual_block" }) });
    toast(rr.status, rr.status==="ok"?"success":"error");
    if(rr.status==="ok"){ document.getElementById("ipHash").value=""; load(); }
  };

  await load();
}
function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

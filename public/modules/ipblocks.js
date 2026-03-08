export async function mount(ctx){
  const { api, toast, mountEl } = ctx;

  mountEl.innerHTML = `
    <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between">
        <div>
          <div class="text-sm font-bold">Banned / IP Blocks</div>
          <div class="text-xs text-slate-500">Kelola blokir & purge expired</div>
        </div>
        <div class="flex gap-2 flex-wrap justify-end">
          <button id="btnReload" class="bg-primary hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold">Reload</button>
          <button id="btnPurge" class="bg-slate-900 hover:bg-black text-white px-3 py-2 rounded-lg text-xs font-bold">Purge</button>
          <button id="btnBlock" class="bg-danger hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-bold">Block</button>
        </div>
      </div>
      <div class="overflow-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr><th class="px-4 py-3 font-semibold">Reason</th><th class="px-4 py-3 font-semibold">Expires</th><th class="px-4 py-3 font-semibold">IP Hash</th><th class="px-4 py-3 font-semibold text-right">Action</th></tr>
          </thead>
          <tbody id="rows" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
        </table>
      </div>
    </div>
  `;

  async function load(){
    const r = await api("/api/ip-blocks?active=1&limit=200");
    const tb = mountEl.querySelector("#rows");
    if(r.status!=="ok"){
      tb.innerHTML = `<tr><td class="px-4 py-3 text-red-500" colspan="4">Failed: ${r.status}</td></tr>`;
      return;
    }
    const rows = r.data.blocks || [];
    tb.innerHTML = rows.map(b=>`
      <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
        <td class="px-4 py-3">${b.reason||""}</td>
        <td class="px-4 py-3 text-slate-500">${b.expires_at||""}</td>
        <td class="px-4 py-3"><code>${b.ip_hash||""}</code></td>
        <td class="px-4 py-3 text-right">
          <button class="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-dark border border-slate-200 dark:border-darkBorder" data-id="${b.id}">Unblock</button>
        </td>
      </tr>
    `).join("");

    tb.querySelectorAll("button[data-id]").forEach(btn=>{
      btn.onclick = async ()=>{
        const id = btn.getAttribute("data-id");
        const rr = await api("/api/ip-blocks/unblock", { method:"POST", body: JSON.stringify({ id }) });
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") load();
      };
    });
  }

  mountEl.querySelector("#btnReload").onclick = load;
  mountEl.querySelector("#btnPurge").onclick = async ()=>{
    const rr = await api("/api/ip-blocks/purge", { method:"POST", body:"{}" });
    toast("Purged: "+(rr.data?.revoked||0), "info");
    load();
  };
  mountEl.querySelector("#btnBlock").onclick = async ()=>{
    const ip_hash = prompt("ip_hash:");
    if(!ip_hash) return;
    const ttl_sec = Number(prompt("ttl_sec:", "3600")||"3600");
    const reason = prompt("reason:", "manual_block") || "manual_block";
    const rr = await api("/api/ip-blocks/block", { method:"POST", body: JSON.stringify({ ip_hash, ttl_sec, reason }) });
    toast(rr.status, rr.status==="ok"?"success":"error");
    if(rr.status==="ok") load();
  };

  await load();
}

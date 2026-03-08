export default function(Orland){
  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const fmt=(sec)=>{const n=Number(sec||0); if(!n) return "-"; try{return new Date(n*1000).toLocaleString();}catch{return String(sec);}};

  function toast(msg,type="info"){
    const host=document.getElementById("toast-host");
    if(!host){alert(msg);return;}
    const d=document.createElement("div");
    d.className="fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    d.innerHTML=`<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(d); setTimeout(()=>d.remove(),2800);
  }

  async function load(q,limit){
    const url="/api/audit?limit="+encodeURIComponent(limit||80)+(q?("&q="+encodeURIComponent(q)):"");
    return await Orland.api(url);
  }

  return {
    title:"Audit Logs",
    async mount(host){
      host.innerHTML=`
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-base font-bold">Audit Logs</div>
            <div class="text-xs text-slate-500 mt-1">Search by action / route / user id.</div>
          </div>
          <div class="flex gap-2">
            <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <i class="fa-solid fa-rotate mr-2"></i>Reload
            </button>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <div class="relative">
              <i class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-400 text-xs"></i>
              <input id="q" class="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="e.g. http.request /api/login actor_user_id">
            </div>
          </div>
          <div>
            <select id="limit" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs">
              <option value="40">40</option>
              <option value="80" selected>80</option>
              <option value="150">150</option>
            </select>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
              <tr>
                <th class="py-3 pr-3">At</th>
                <th class="py-3 pr-3">Action</th>
                <th class="py-3 pr-3">Route</th>
                <th class="py-3 pr-3">Actor</th>
                <th class="py-3 pr-3">Status</th>
              </tr>
            </thead>
            <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
          </table>
        </div>
      </div>`;
      const tb=host.querySelector("#tb");
      const qEl=host.querySelector("#q");
      const limitEl=host.querySelector("#limit");

      async function render(){
        tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="5">Loading…</td></tr>`;
        const r=await load(String(qEl.value||"").trim(), Number(limitEl.value||80));
        if(r.status!=="ok"){
          tb.innerHTML=`<tr><td class="py-4 text-red-400" colspan="5">Failed: ${esc(r.status)}</td></tr>`;
          toast(r.status,"error"); return;
        }
        const rows=r.data?.rows||[];
        if(!rows.length){
          tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="5">No logs</td></tr>`; return;
        }
        tb.innerHTML=rows.map(x=>`
          <tr>
            <td class="py-3 pr-3 text-slate-500">${esc(fmt(x.created_at))}</td>
            <td class="py-3 pr-3"><code>${esc(x.action||"")}</code></td>
            <td class="py-3 pr-3 text-slate-500">${esc(x.route||x.target_id||"")}</td>
            <td class="py-3 pr-3 text-slate-500"><code>${esc(x.actor_user_id||"")}</code></td>
            <td class="py-3 pr-3">${esc(String(x.http_status||""))}</td>
          </tr>
        `).join("");
      }

      host.querySelector("#btnReload").onclick=render;
      qEl.addEventListener("keydown",(e)=>{ if(e.key==="Enter") render(); });
      limitEl.addEventListener("change", render);
      await render();
    }
  };
}

export default function(Orland){
  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  function toast(msg,type="info"){
    const host=document.getElementById("toast-host");
    if(!host){alert(msg);return;}
    const d=document.createElement("div");
    d.className="fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    d.innerHTML=`<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(d); setTimeout(()=>d.remove(),2800);
  }

  async function list(){ return await Orland.api("/api/ip-blocks?active=1&limit=100"); }
  async function unblock(id){ return await Orland.api("/api/ip-blocks/unblock",{method:"POST",body:JSON.stringify({id})}); }
  async function block(ip_hash, ttl_sec, reason){
    return await Orland.api("/api/ip-blocks/block",{method:"POST",body:JSON.stringify({ip_hash,ttl_sec,reason})});
  }
  async function purge(){ return await Orland.api("/api/ip-blocks/purge",{method:"POST",body:"{}"}); }

  return {
    title:"Banned / IP Blocks",
    async mount(host){
      host.innerHTML=`
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-base font-bold">Banned / IP Blocks</div>
            <div class="text-xs text-slate-500 mt-1">Unblock / manual block (by ip_hash).</div>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button id="btnBlock" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
              <i class="fa-solid fa-ban mr-2"></i>Block
            </button>
            <button id="btnPurge" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <i class="fa-solid fa-broom mr-2"></i>Purge Expired
            </button>
            <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <i class="fa-solid fa-rotate mr-2"></i>Reload
            </button>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
              <tr><th class="py-3 pr-3">Reason</th><th class="py-3 pr-3">Expires</th><th class="py-3 pr-3">ip_hash</th><th class="py-3 text-right">Action</th></tr>
            </thead>
            <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
          </table>
        </div>
      </div>`;

      const tb=host.querySelector("#tb");

      async function render(){
        tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="4">Loading…</td></tr>`;
        const r=await list();
        if(r.status!=="ok"){ tb.innerHTML=`<tr><td class="py-4 text-red-400" colspan="4">Failed: ${esc(r.status)}</td></tr>`; return; }
        const rows=r.data?.blocks||[];
        if(!rows.length){ tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="4">No active blocks</td></tr>`; return; }
        tb.innerHTML=rows.map(b=>`
          <tr>
            <td class="py-3 pr-3">${esc(b.reason||"")}</td>
            <td class="py-3 pr-3 text-slate-500">${esc(String(b.expires_at||""))}</td>
            <td class="py-3 pr-3"><code>${esc(b.ip_hash||"")}</code></td>
            <td class="py-3 text-right"><button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-id="${esc(b.id)}">Unblock</button></td>
          </tr>
        `).join("");

        tb.querySelectorAll("button[data-id]").forEach(btn=>{
          btn.onclick=async ()=>{
            const id=btn.getAttribute("data-id");
            const rr=await unblock(id);
            toast(rr.status, rr.status==="ok"?"success":"error");
            if(rr.status==="ok") render();
          };
        });
      }

      host.querySelector("#btnReload").onclick=render;
      host.querySelector("#btnPurge").onclick=async ()=>{
        const rr=await purge();
        toast(rr.status==="ok" ? ("Purged "+String(rr.data?.revoked||0)) : rr.status, rr.status==="ok"?"success":"error");
        render();
      };
      host.querySelector("#btnBlock").onclick=async ()=>{
        const ip_hash=prompt("ip_hash:", "");
        if(!ip_hash) return;
        const ttl_sec=Number(prompt("ttl_sec:", "3600")||"3600");
        const reason=prompt("reason:", "manual_block")||"manual_block";
        const rr=await block(ip_hash, ttl_sec, reason);
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") render();
      };

      await render();
    }
  };
}

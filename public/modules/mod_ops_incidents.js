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

  async function list(limit){
    return await Orland.api("/api/incidents?limit="+encodeURIComponent(limit||50));
  }
  async function create(payload){
    return await Orland.api("/api/incidents", { method:"POST", body: JSON.stringify(payload) });
  }
  async function update(id, action){
    return await Orland.api("/api/incidents", { method:"PUT", body: JSON.stringify({ id, action }) });
  }

  function modalTpl(title, body){
    return `
      <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" data-close="1"></div>
        <div class="relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between">
            <div class="text-sm font-bold">${esc(title)}</div>
            <button class="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5" data-close="1">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="p-4">${body}</div>
        </div>
      </div>`;
  }

  return {
    title:"Incidents & Alerts",
    async mount(host){
      host.innerHTML=`
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-base font-bold">Incidents & Alerts</div>
            <div class="text-xs text-slate-500 mt-1">Create/ack/close incidents.</div>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button id="btnCreate" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
              <i class="fa-solid fa-plus mr-2"></i>Create
            </button>
            <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <i class="fa-solid fa-rotate mr-2"></i>Reload
            </button>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
              <tr>
                <th class="py-3 pr-3">Severity</th>
                <th class="py-3 pr-3">Type</th>
                <th class="py-3 pr-3">Summary</th>
                <th class="py-3 pr-3">Status</th>
                <th class="py-3 pr-3">Created</th>
                <th class="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
          </table>
        </div>
      </div>`;

      const tb=host.querySelector("#tb");

      async function render(){
        tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="6">Loading…</td></tr>`;
        const r=await list(80);
        if(r.status!=="ok"){
          tb.innerHTML=`<tr><td class="py-4 text-red-400" colspan="6">Failed: ${esc(r.status)}</td></tr>`;
          return;
        }
        const rows=r.data?.rows||[];
        if(!rows.length){
          tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="6">No incidents</td></tr>`;
          return;
        }
        tb.innerHTML=rows.map(x=>`
          <tr>
            <td class="py-3 pr-3 font-bold">${esc(x.severity||"")}</td>
            <td class="py-3 pr-3 text-slate-500">${esc(x.type||"")}</td>
            <td class="py-3 pr-3">${esc(x.summary||"")}</td>
            <td class="py-3 pr-3">${esc(x.status||"")}</td>
            <td class="py-3 pr-3 text-slate-500">${esc(fmt(x.created_at))}</td>
            <td class="py-3 text-right">
              <div class="flex justify-end gap-2 flex-wrap">
                <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-act="ack" data-id="${esc(x.id)}">Ack</button>
                <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-act="close" data-id="${esc(x.id)}">Close</button>
              </div>
            </td>
          </tr>
        `).join("");

        tb.querySelectorAll("button[data-act]").forEach(btn=>{
          btn.onclick=async ()=>{
            const id=btn.getAttribute("data-id");
            const act=btn.getAttribute("data-act");
            const rr=await update(id, act);
            toast(rr.status, rr.status==="ok"?"success":"error");
            if(rr.status==="ok") render();
          };
        });
      }

      host.querySelector("#btnReload").onclick=render;

      host.querySelector("#btnCreate").onclick=()=>{
        const modal=document.createElement("div");
        modal.innerHTML=modalTpl("Create Incident", `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">severity</div>
              <select id="sev" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs">
                <option>low</option><option>medium</option><option>high</option><option>critical</option>
              </select>
            </div>
            <div>
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">type</div>
              <input id="type" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="security|ops|db|...">
            </div>
            <div class="md:col-span-2">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">summary</div>
              <input id="sum" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="Ringkas masalah...">
            </div>
          </div>
          <div class="mt-4 flex gap-2">
            <button id="ok" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white w-full">Create</button>
            <button id="cancel" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder w-full">Cancel</button>
          </div>
        `);
        document.body.appendChild(modal.firstElementChild);
        const root=document.body.lastElementChild;
        const close=()=>root.remove();
        root.querySelectorAll("[data-close],#cancel").forEach(x=>x.onclick=close);
        root.querySelector("#ok").onclick=async ()=>{
          const payload={
            severity: String(root.querySelector("#sev").value||"low"),
            type: String(root.querySelector("#type").value||"ops").trim() || "ops",
            summary: String(root.querySelector("#sum").value||"").trim()
          };
          if(!payload.summary){ toast("summary required","error"); return; }
          const rr=await create(payload);
          toast(rr.status, rr.status==="ok"?"success":"error");
          if(rr.status==="ok"){ close(); render(); }
        };
      };

      await render();
    }
  };
}

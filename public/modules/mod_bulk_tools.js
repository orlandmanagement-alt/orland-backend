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

  async function run(action){
    return await Orland.api("/api/admin/bulk", { method:"POST", body: JSON.stringify({ action }) });
  }

  return {
    title:"Bulk Tools",
    async mount(host){
      host.innerHTML=`
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
        <div class="text-base font-bold">Bulk Tools (super_admin)</div>
        <div class="text-xs text-slate-500 mt-1">Danger zone. Actions are irreversible.</div>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button class="act px-3 py-3 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-danger/10 text-danger" data-act="clear_audit">
            Clear Audit Logs
          </button>
          <button class="act px-3 py-3 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-act="purge_sessions">
            Purge Sessions (revoked + expired)
          </button>
          <button class="act px-3 py-3 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-danger/10 text-danger" data-act="clear_tasks">
            Clear Tasks Queue
          </button>
          <button class="act px-3 py-3 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-danger/10 text-danger" data-act="clear_dlq">
            Clear DLQ
          </button>
          <button class="act px-3 py-3 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-act="purge_ipblocks">
            Purge IP Blocks (expire -> revoke)
          </button>
        </div>

        <pre id="out" class="mt-4 text-[10px] bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-darkBorder rounded-xl p-3 overflow-auto hidden"></pre>
      </div>`;

      const out=host.querySelector("#out");
      host.querySelectorAll(".act").forEach(btn=>{
        btn.onclick=async ()=>{
          const act=btn.getAttribute("data-act");
          if(!confirm("Run action: "+act+" ?")) return;
          const r=await run(act);
          out.classList.remove("hidden");
          out.textContent=JSON.stringify(r,null,2);
          toast(r.status, r.status==="ok"?"success":"error");
        };
      });
    }
  };
}

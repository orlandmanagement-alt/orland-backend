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

  return {
    title:"Export Data",
    async mount(host){
      host.innerHTML=`
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
        <div class="text-base font-bold">Export Data</div>
        <div class="text-xs text-slate-500 mt-1">Endpoint bisa kamu sambungkan ke job/tasks nanti (cron/manual).</div>

        <div class="mt-4 flex gap-2 flex-wrap">
          <button id="btnExport" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
            <i class="fa-solid fa-file-export mr-2"></i>Run Export
          </button>
          <button id="btnGoImport" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
            <i class="fa-solid fa-file-import mr-2"></i>Go Import
          </button>
        </div>

        <pre id="out" class="mt-4 text-[10px] bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-darkBorder rounded-xl p-3 overflow-auto hidden"></pre>
      </div>`;

      const out=host.querySelector("#out");
      host.querySelector("#btnGoImport").onclick=()=>Orland.navigate("/data/import");
      host.querySelector("#btnExport").onclick=async ()=>{
        out.classList.remove("hidden");
        out.textContent="Calling /api/data/export (if exists)…";
        const r=await Orland.api("/api/data/export");
        out.textContent=JSON.stringify(r,null,2);
        toast(r.status, r.status==="ok"?"success":"error");
      };
    }
  };
}

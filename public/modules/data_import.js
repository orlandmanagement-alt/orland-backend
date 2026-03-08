export default function DataImportModule(ctx){
  const { api, toast, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div>
      <h2 class="text-xl font-bold text-slate-900 dark:text-white">Import Data</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Super Admin only. Paste JSON from Export.</p>
    </div>

    <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 mt-4">
      <div class="font-bold">Paste JSON</div>
      <textarea id="txt" class="mt-3 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs" rows="14" placeholder="Paste export JSON here..."></textarea>
      <div class="mt-3 flex gap-2">
        <button id="btnImport" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Import</button>
        <button id="btnClear" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Clear</button>
      </div>

      <details class="mt-4">
        <summary class="text-xs text-slate-500 cursor-pointer">Result</summary>
        <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
      </details>
    </div>
  `;

  async function doImport(){
    const raw = el.querySelector("#txt").value.trim();
    if(!raw) return toast("empty","info");
    let obj;
    try{ obj = JSON.parse(raw); }catch{ return toast("invalid json","error"); }

    if(!confirm("Import data? (super admin only)")) return;

    const r = await api("/api/data/import", { method:"POST", body: JSON.stringify(obj) });
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  }

  return {
    mount(host){
      setBreadcrumb("/ data / import");
      host.innerHTML="";
      host.appendChild(el);
      el.querySelector("#btnImport").onclick = doImport;
      el.querySelector("#btnClear").onclick = ()=> el.querySelector("#txt").value="";
    },
    unmount(){}
  };
}

export default function DataExportModule(ctx){
  const { api, toast, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Export Data</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Export admin config scope (menus, roles, settings, alert rules).</p>
      </div>
      <div class="flex gap-2">
        <button id="btnExport" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Export JSON</button>
      </div>
    </div>

    <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 mt-4">
      <div class="font-bold">Output</div>
      <div class="text-xs text-slate-500 mt-1">Click Export, then copy JSON or download.</div>
      <textarea id="txt" class="mt-3 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs" rows="14" placeholder="Export result..."></textarea>
      <div class="mt-3 flex gap-2">
        <button id="btnCopy" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Copy</button>
        <button id="btnDownload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Download</button>
      </div>
    </div>
  `;

  function download(filename, text){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type:"application/json" }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function doExport(){
    const r = await api("/api/data/export", { method:"POST", body:"{}" });
    if(r.status!=="ok"){ toast("export failed: "+r.status,"error"); return; }
    const s = JSON.stringify(r.data, null, 2);
    el.querySelector("#txt").value = s;
    toast("export ok","success");
  }

  async function copy(){
    const t = el.querySelector("#txt").value || "";
    if(!t) return toast("empty","info");
    await navigator.clipboard.writeText(t);
    toast("copied","success");
  }

  function dl(){
    const t = el.querySelector("#txt").value || "";
    if(!t) return toast("empty","info");
    download("orland_export.json", t);
  }

  return {
    mount(host){
      setBreadcrumb("/ data / export");
      host.innerHTML="";
      host.appendChild(el);
      el.querySelector("#btnExport").onclick = doExport;
      el.querySelector("#btnCopy").onclick = copy;
      el.querySelector("#btnDownload").onclick = dl;
    },
    unmount(){}
  };
}

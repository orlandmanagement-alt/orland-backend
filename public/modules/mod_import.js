export async function mount(ctx){
  const { host, api, toast } = ctx;
  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="text-sm font-bold">Import Data</div>
      <div class="text-xs text-slate-500 mt-2">Enqueue import task to /api/data/import</div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <select id="imMode" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="merge">merge</option>
          <option value="replace">replace</option>
        </select>
        <select id="imSrc" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="manual">manual</option>
          <option value="r2">r2</option>
        </select>
        <button id="imGo" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Queue Import</button>
      </div>

      <pre id="imOut" class="mt-4 text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
    </div>
  `;
  document.getElementById("imGo").onclick = async ()=>{
    const mode = document.getElementById("imMode").value;
    const source = document.getElementById("imSrc").value;
    const r = await api("/api/data/import",{ method:"POST", body: JSON.stringify({ mode, source }) });
    document.getElementById("imOut").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };
}

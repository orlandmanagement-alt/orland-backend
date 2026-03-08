export async function mount(ctx){
  const { host, api, toast } = ctx;
  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="text-sm font-bold">Export Data</div>
      <div class="text-xs text-slate-500 mt-2">Enqueue export task to /api/data/export</div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <select id="exMode" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="redacted">redacted</option>
          <option value="full">full</option>
        </select>
        <select id="exDest" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="download">download</option>
          <option value="r2">r2</option>
        </select>
        <button id="exGo" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Queue Export</button>
      </div>

      <pre id="exOut" class="mt-4 text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
    </div>
  `;
  document.getElementById("exGo").onclick = async ()=>{
    const mode = document.getElementById("exMode").value;
    const destination = document.getElementById("exDest").value;
    const r = await api("/api/data/export",{ method:"POST", body: JSON.stringify({ mode, destination }) });
    document.getElementById("exOut").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };
}
